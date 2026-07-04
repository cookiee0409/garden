import {
  BALANCE_ID,
  COMPOST_MS,
  CRITTER_DEFS,
  CROP_DEFS,
  CURRENT_SAVE_VERSION,
  DECOR_DEFS,
  FORAGE_DEFS,
  FORAGE_POSITIONS,
  GATHER_REFILL_MS,
  OFFLINE_GROWTH_CAP_MS,
  QUALITY_DEFS,
  VISITORS,
  WILT_AFTER_MS,
} from "./data";
import type {
  CodexEntry,
  CompostState,
  CropState,
  CropStatus,
  CritterType,
  DecorationType,
  GameState,
  GatherSpot,
  ItemInfo,
  PlacedDecoration,
  PlotState,
  QualityId,
  SeasonId,
  WeatherId,
} from "./types";

export function createDefaultState(now = Date.now()): GameState {
  return {
    version: CURRENT_SAVE_VERSION,
    balanceId: BALANCE_ID,
    gold: 120,
    selectedSeed: "tomato",
    selectedPlot: null,
    scene: "garden",
    seeds: {
      tomato: 4,
      carrot: 2,
      strawberry: 0,
      sunflower: 0,
      watermelon: 0,
      moon_mushroom: 0,
      rainbow_flower: 0,
    },
    plots: Array.from({ length: 9 }, (_, index) => ({
      id: index,
      unlocked: index < 4,
      crop: null,
    })),
    inventory: {},
    codex: {},
    claimedRewards: [],
    streak: 0,
    lastLoginDate: null,
    goldenWater: 0,
    fertilizer: 0,
    gather: {
      lastRefillAt: now,
      charges: 0,
      spots: makeGatherSpots(now),
    },
    dailyVisitor: null,
    lastRainWateredDate: null,
    decorations: [],
    compost: {
      slots: [null, null],
    },
    createdAt: now,
    lastSeenAt: now,
  };
}

export function sanitizeCrop(crop: Partial<CropState> | null | undefined, now = Date.now()): CropState | null {
  if (!crop || !crop.type || !CROP_DEFS[crop.type]) return null;
  const plantedAt = typeof crop.plantedAt === "number" ? crop.plantedAt : now;
  return {
    type: crop.type,
    plantedAt: Math.min(plantedAt, now),
    boostMs: typeof crop.boostMs === "number" ? crop.boostMs : 0,
    watered: Boolean(crop.watered),
    fertilized: Boolean(crop.fertilized),
  };
}

export function sanitizeDecorations(decorations: unknown): PlacedDecoration[] {
  if (!Array.isArray(decorations)) return [];
  return decorations
    .map((decoration): PlacedDecoration | null => {
      if (!decoration || typeof decoration !== "object") return null;
      const item = decoration as Partial<PlacedDecoration>;
      if (!item.id || typeof item.id !== "string") return null;
      if (!item.type || !DECOR_DEFS[item.type]) return null;

      const x = typeof item.x === "number" && Number.isFinite(item.x) ? item.x : null;
      const z = typeof item.z === "number" && Number.isFinite(item.z) ? item.z : null;
      const rotY = typeof item.rotY === "number" && Number.isFinite(item.rotY) ? item.rotY : 0;
      return { id: item.id, type: item.type as DecorationType, x, z, rotY };
    })
    .filter((decoration): decoration is PlacedDecoration => Boolean(decoration));
}

export function sanitizeCompost(compost: unknown, now = Date.now()): CompostState {
  const slots = compost && typeof compost === "object" && Array.isArray((compost as CompostState).slots)
    ? (compost as CompostState).slots
    : [];

  return {
    slots: Array.from({ length: 2 }, (_, index) => {
      const slot = slots[index];
      if (!slot || typeof slot !== "object") return null;
      const itemKey = (slot as { itemKey?: unknown }).itemKey;
      const startedAt = (slot as { startedAt?: unknown }).startedAt;
      if (typeof itemKey !== "string" || !itemKey.startsWith("crop|") || !itemKey.endsWith("|wilted")) return null;
      return {
        itemKey,
        startedAt: typeof startedAt === "number" && Number.isFinite(startedAt) ? Math.min(startedAt, now) : now,
      };
    }),
  };
}

export function mergeSavedState(saved: Partial<GameState> | null, now = Date.now()): GameState {
  const base = createDefaultState(now);
  if (!saved) return base;

  const merged: GameState = {
    ...base,
    ...saved,
    seeds: { ...base.seeds, ...(saved.seeds || {}) },
    inventory: { ...(saved.inventory || {}) },
    codex: { ...(saved.codex || {}) },
    claimedRewards: Array.isArray(saved.claimedRewards) ? saved.claimedRewards : [],
    plots: base.plots.map((plot, index) => ({
      ...plot,
      ...((saved.plots || [])[index] || {}),
    })),
    gather: {
      ...base.gather,
      ...(saved.gather || {}),
    },
    decorations: sanitizeDecorations(saved.decorations),
    compost: sanitizeCompost(saved.compost, now),
  };

  merged.plots = merged.plots.map((plot: PlotState, index: number) => ({
    id: index,
    unlocked: Boolean(plot.unlocked),
    crop: sanitizeCrop(plot.crop, now),
  }));

  if (!CROP_DEFS[merged.selectedSeed]) merged.selectedSeed = "tomato";
  if (!["garden", "forest"].includes(merged.scene)) merged.scene = "garden";
  if (!Array.isArray(merged.gather.spots)) merged.gather.spots = makeGatherSpots(now);
  if (typeof merged.gather.charges !== "number") merged.gather.charges = 0;
  if (typeof merged.gather.lastRefillAt !== "number") merged.gather.lastRefillAt = now;
  if (typeof merged.gold !== "number") merged.gold = base.gold;
  if (typeof merged.goldenWater !== "number") merged.goldenWater = 0;
  if (typeof merged.fertilizer !== "number") merged.fertilizer = 0;
  if (typeof merged.streak !== "number") merged.streak = 0;
  if (typeof merged.lastRainWateredDate !== "string") merged.lastRainWateredDate = null;
  merged.decorations = sanitizeDecorations(merged.decorations);
  merged.compost = sanitizeCompost(merged.compost, now);
  if (merged.balanceId !== BALANCE_ID) {
    merged.plots.forEach((plot) => {
      if (!plot.crop) return;
      const crop = CROP_DEFS[plot.crop.type];
      plot.crop.plantedAt = now - crop.growMs;
      plot.crop.boostMs = 0;
    });
    merged.balanceId = BALANCE_ID;
  }
  merged.version = CURRENT_SAVE_VERSION;

  return merged;
}

export function applyOfflineGrowthCap(state: GameState, now = Date.now()): boolean {
  const lastSeenAt = typeof state.lastSeenAt === "number" ? state.lastSeenAt : now;
  const offlineElapsed = Math.max(0, now - lastSeenAt);
  const cappedOutMs = Math.max(0, offlineElapsed - OFFLINE_GROWTH_CAP_MS);
  if (cappedOutMs <= 0) return false;

  state.plots.forEach((plot) => {
    if (plot.crop) plot.crop.plantedAt += cappedOutMs;
  });
  return true;
}

export function applyDailyLogin(state: GameState, now = Date.now()): string[] {
  const today = getDayKey(now);
  if (state.lastLoginDate === today) return [];

  const previous = state.lastLoginDate;
  const wasYesterday = Boolean(previous) && getDayIndex(today) - getDayIndex(previous as string) === 1;
  state.streak = wasYesterday ? state.streak + 1 : 1;
  state.lastLoginDate = today;
  state.goldenWater = Math.min(3, state.goldenWater + 1);

  return [
    `오늘의 첫 접속 보상으로 황금 물뿌리개 1회를 받았습니다. 연속 출석 ${state.streak}일째입니다.`,
  ];
}

export function applyDailyWeatherEffects(state: GameState, now = Date.now()): string | null {
  const weather = getWeather(now);
  if (weather === "clear") return null;

  const today = getDayKey(now);
  if (state.lastRainWateredDate === today) return null;

  let wateredCount = 0;
  state.plots.forEach((plot) => {
    if (!plot.crop) return;
    const status = getCropStatus(plot, now);
    if (status.isReady || plot.crop.watered) return;
    plot.crop.watered = true;
    wateredCount += 1;
  });
  state.lastRainWateredDate = today;

  if (weather === "snow") return wateredCount > 0 ? "눈이 녹아 밭이 촉촉해졌습니다." : "눈이 내려 정원이 조용히 반짝입니다.";
  return wateredCount > 0 ? "비가 내려 밭이 촉촉해졌습니다." : "비가 내려 정원이 촉촉해졌습니다.";
}

export function ensureDailyVisitor(state: GameState, now = Date.now()): boolean {
  const today = getDayKey(now);
  if (state.dailyVisitor && state.dailyVisitor.date === today) {
    if (state.dailyVisitor.bonus === 1.5) return false;
    state.dailyVisitor.bonus = 1.5;
    return true;
  }

  const availableCrops = Object.keys(CROP_DEFS).filter((cropId) => {
    const crop = CROP_DEFS[cropId];
    return !crop.unlockCodex || getCodexCount(state) >= crop.unlockCodex;
  });
  const cropType = availableCrops[hashString(today) % availableCrops.length];
  const visitorName = VISITORS[hashString(`${today}:visitor`) % VISITORS.length];

  state.dailyVisitor = {
    date: today,
    name: visitorName,
    cropType,
    bonus: 1.5,
    done: false,
  };
  return true;
}

export function applyGatherRefill(state: GameState, now = Date.now()): boolean {
  let changed = false;
  if (!state.gather) {
    state.gather = { lastRefillAt: now, charges: 0, spots: makeGatherSpots(now) };
    return true;
  }

  if (state.gather.lastRefillAt > now) {
    state.gather.lastRefillAt = now;
    changed = true;
  }

  const elapsed = now - state.gather.lastRefillAt;
  const refillCount = Math.floor(elapsed / GATHER_REFILL_MS);
  if (refillCount > 0) {
    state.gather.charges = Math.min(2, state.gather.charges + refillCount);
    state.gather.lastRefillAt += refillCount * GATHER_REFILL_MS;
    changed = true;
  }

  return changed;
}

export function getCropStatus(plot: PlotState, now = Date.now()): CropStatus {
  const crop = plot.crop as CropState;
  const def = CROP_DEFS[crop.type];
  const boostedElapsed = now - crop.plantedAt + (crop.boostMs || 0);
  const elapsed = Math.max(0, boostedElapsed);
  const progress = clamp(elapsed / def.growMs, 0, 1);
  const remaining = Math.max(0, def.growMs - elapsed);
  const matureAt = crop.plantedAt + Math.max(0, def.growMs - (crop.boostMs || 0));
  const wilted = progress >= 1 && now - matureAt > WILT_AFTER_MS;
  const stage = progress >= 1 ? "ready" : progress >= 0.45 ? "middle" : "sprout";
  return { def, elapsed, progress, remaining, matureAt, wilted, stage, isReady: progress >= 1 };
}

export function rollQuality(hasWaterBonus: boolean, hasFertilizerBonus = false): QualityId {
  const goldChance = (hasWaterBonus ? 0.18 : 0.08) + (hasFertilizerBonus ? 0.18 : 0);
  const silverChance = (hasWaterBonus ? 0.34 : 0.22) + (hasFertilizerBonus ? 0.18 : 0);
  const roll = Math.random();
  if (roll < goldChance) return "gold";
  if (roll < goldChance + silverChance) return "silver";
  return "normal";
}

export function makeGatherSpots(now = Date.now()): GatherSpot[] {
  return FORAGE_POSITIONS.map((_, index) => ({
    id: `${now}-${index}`,
    item: pickForageItem(now),
    collected: false,
  }));
}

export function pickForageItem(now = Date.now()): string {
  const night = isNightTime(now);
  const season = getSeason(now);
  const pool = Object.values(FORAGE_DEFS).filter((item) => {
    if (item.nightOnly && !night) return false;
    if (item.season && item.season !== season) return false;
    return true;
  });
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of pool) {
    roll -= item.weight;
    if (roll <= 0) return item.id;
  }
  return pool[0].id;
}

export function getSeason(now = Date.now()): SeasonId {
  const month = new Date(now).getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function getWeather(now = Date.now()): WeatherId {
  const season = getSeason(now);
  const roll = hashString(`${getDayKey(now)}:weather`) % 100;
  if (roll >= 75) return season === "winter" ? "snow" : "rain";
  return "clear";
}

export function getSeasonName(season: SeasonId): string {
  if (season === "spring") return "봄";
  if (season === "summer") return "여름";
  if (season === "autumn") return "가을";
  return "겨울";
}

export function getWeatherName(weather: WeatherId): string {
  if (weather === "rain") return "비";
  if (weather === "snow") return "눈";
  return "맑음";
}

export function isNightTime(now = Date.now()): boolean {
  const hour = new Date(now).getHours();
  return hour >= 19 || hour < 5;
}

export function addInventory(state: GameState, key: string, amount: number): void {
  state.inventory[key] = (state.inventory[key] || 0) + amount;
}

export function addCodex(state: GameState, key: string, now = Date.now()): void {
  if (state.codex[key]) return;
  state.codex[key] = { firstObtainedAt: now };
}

export function isDecorationPlaced(decoration: PlacedDecoration): decoration is PlacedDecoration & { x: number; z: number } {
  return typeof decoration.x === "number" && typeof decoration.z === "number";
}

export function getCoziness(state: GameState): number {
  return state.decorations.reduce((sum, decoration) => {
    if (!isDecorationPlaced(decoration)) return sum;
    return sum + (DECOR_DEFS[decoration.type]?.cozy || 0);
  }, 0);
}

export function getVisitorBonus(state: GameState): number {
  return Number((1.5 + Math.min(0.3, getCoziness(state) * 0.01)).toFixed(2));
}

export function makeDecorationId(type: DecorationType, now = Date.now()): string {
  return `decor-${type}-${now}-${Math.floor(Math.random() * 100000)}`;
}

export function getItemInfo(key: string): ItemInfo {
  const { kind, id, quality } = parseItemKey(key);
  if (kind === "crop") {
    const crop = CROP_DEFS[id];
    const qualityDef = QUALITY_DEFS[quality as QualityId] || QUALITY_DEFS.normal;
    return {
      kind,
      id,
      quality,
      name: `${crop.name} (${qualityDef.name})`,
      sellPrice: Math.round(crop.sellPrice * qualityDef.multiplier),
      qualityClass: qualityDef.className,
    };
  }

  const forage = FORAGE_DEFS[id];
  return {
    kind,
    id,
    quality,
    name: forage.name,
    sellPrice: forage.sellPrice,
    qualityClass: "quality-normal",
  };
}

export function makeItemKey(kind: string, id: string, quality: string): string {
  return `${kind}|${id}|${quality}`;
}

export function parseItemKey(key: string): { kind: string; id: string; quality: string } {
  const [kind, id, quality] = key.split("|");
  return { kind, id, quality };
}

export function findInventoryCropKey(state: GameState, cropType: string): string | null {
  const priority: QualityId[] = ["wilted", "normal", "silver", "gold"];
  for (const quality of priority) {
    const key = makeItemKey("crop", cropType, quality);
    if ((state.inventory[key] || 0) > 0) return key;
  }
  return null;
}

export function getPossibleCodexEntries(): CodexEntry[] {
  const cropEntries = Object.values(CROP_DEFS).flatMap((crop) =>
    (["normal", "silver", "gold"] as QualityId[]).map((quality) => ({
      key: makeItemKey("crop", crop.id, quality),
      label: `${crop.name} ${QUALITY_DEFS[quality].name}`,
    })),
  );

  const forageEntries = Object.values(FORAGE_DEFS).map((item) => ({
    key: makeItemKey("forage", item.id, "normal"),
    label: item.name,
  }));

  const critterEntries = Object.values(CRITTER_DEFS).map((critter) => ({
    key: makeItemKey("critter", critter.id, "normal"),
    label: critter.name,
  }));

  return [...cropEntries, ...forageEntries, ...critterEntries];
}

export function getCodexCount(state: GameState): number {
  return getPossibleCodexEntries().filter((entry) => Boolean(state.codex[entry.key])).length;
}

export function getCompostRemainingMs(slot: CompostState["slots"][number] | null, now = Date.now()): number {
  if (!slot) return 0;
  return Math.max(0, slot.startedAt + COMPOST_MS - now);
}

export function getCompostReadyCount(state: GameState, now = Date.now()): number {
  return state.compost.slots.filter((slot) => slot && getCompostRemainingMs(slot, now) <= 0).length;
}

export function hasEmptyCompostSlot(state: GameState): boolean {
  return state.compost.slots.some((slot) => slot === null);
}

export function findWiltedInventoryKey(state: GameState): string | null {
  const cropOrder = Object.keys(CROP_DEFS);
  const entries = Object.entries(state.inventory).filter(([key, quantity]) => quantity > 0 && key.startsWith("crop|") && key.endsWith("|wilted"));
  entries.sort(([left], [right]) => {
    const leftIndex = cropOrder.indexOf(parseItemKey(left).id);
    const rightIndex = cropOrder.indexOf(parseItemKey(right).id);
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  });
  return entries[0]?.[0] ?? null;
}

export function getEligibleCritters(state: GameState, now = Date.now()): CritterType[] {
  const night = isNightTime(now);
  const weather = getWeather(now);
  const growingCrops = state.plots.map((plot) => plot.crop).filter(Boolean) as CropState[];
  const hasFlowerCrop = growingCrops.some((crop) => crop.type === "sunflower" || crop.type === "rainbow_flower");
  const wateredPlots = growingCrops.filter((crop) => crop.watered).length;
  const hasCarrot = growingCrops.some((crop) => crop.type === "carrot");
  const cozy = getCoziness(state);
  const eligible: CritterType[] = [];

  if (!night && hasFlowerCrop) eligible.push("butterfly");
  if (!night && wateredPlots >= 2) eligible.push("sparrow");
  if (!night && hasCarrot) eligible.push("rabbit");
  if (weather !== "clear") eligible.push("frog");
  if (night && cozy >= 5) eligible.push("hedgehog");
  if (night) eligible.push("owl");

  return eligible;
}

export function pickCritterType(state: GameState, now = Date.now()): CritterType | null {
  const eligible = getEligibleCritters(state, now);
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function getCritterTrace(state: GameState, offlineMs: number, now = Date.now()): string | null {
  const traceAt = now - Math.max(0, Math.floor(offlineMs / 2));
  const eligible = getEligibleCritters(state, traceAt);
  if (eligible.length === 0) return null;
  const type = eligible[hashString(`${getDayKey(traceAt)}:${offlineMs}:critter-trace`) % eligible.length];
  const dayPart = isNightTime(traceAt) ? "밤사이" : "잠시";
  return `${dayPart} ${CRITTER_DEFS[type].name}가 다녀간 흔적이 있어요.`;
}

export function getGatherRemainingMs(state: GameState, now = Date.now()): number {
  if (state.gather.charges >= 2) return 0;
  const elapsed = now - state.gather.lastRefillAt;
  return Math.max(0, GATHER_REFILL_MS - (elapsed % GATHER_REFILL_MS));
}

export function getDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDayIndex(key: string): number {
  return Math.floor(new Date(`${key}T00:00:00`).getTime() / 86400000);
}

export function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "완료";
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}초`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours}시간 ${restMinutes}분` : `${hours}시간`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
