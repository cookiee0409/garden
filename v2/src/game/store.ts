import { create } from "zustand";
import {
  BALANCE_PRESETS,
  CODEX_REWARDS,
  CRITTER_DEFS,
  CROP_DEFS,
  DECOR_DEFS,
  FERTILIZER_RECIPE,
  GATHER_REFILL_MS,
  PLOT_UNLOCK_COSTS,
  QUALITY_DEFS,
  SAVE_KEY,
} from "./data";
import { isSameTarget } from "./interactions";
import {
  addCodex,
  addInventory,
  applyDailyLogin,
  applyGatherRefill,
  applyDailyWeatherEffects,
  applyOfflineGrowthCap,
  createDefaultState,
  ensureDailyVisitor,
  findInventoryCropKey,
  findWiltedInventoryKey,
  formatDuration,
  getCompostReadyCount,
  getCompostRemainingMs,
  getCodexCount,
  getCoziness,
  getCropStatus,
  getCritterTrace,
  getDayKey,
  getGatherRemainingMs,
  getItemInfo,
  getVisitorBonus,
  getWeather,
  getWeatherName,
  hasEmptyCompostSlot,
  makeGatherSpots,
  makeDecorationId,
  makeItemKey,
  mergeSavedState,
  pickCritterType,
  rollQuality,
} from "./logic";
import { migrate } from "./save";
import type {
  CareEffect,
  ActiveCritter,
  CritterType,
  DecorationType,
  GameState,
  HarvestEffect,
  InteractionPrompt,
  InteractionTarget,
  PlayerSpawnId,
  QualityId,
  SceneId,
  WelcomeSummary,
} from "./types";

const WELCOME_BACK_THRESHOLD_MS = 30 * 60 * 1000;
const SCENE_INTERACTION_COOLDOWN_MS = 500;

function readSave(): Partial<GameState> | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as Partial<GameState>) : null;
  } catch (error) {
    console.warn("Save data could not be read.", error);
    return null;
  }
}

function writeSave(game: GameState): void {
  try {
    game.lastSeenAt = Date.now();
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  } catch (error) {
    console.warn("Save data could not be written.", error);
  }
}

function buildWelcomeSummary(game: GameState, now: number): WelcomeSummary | null {
  const offlineMs = Math.max(0, now - game.lastSeenAt);
  if (offlineMs < WELCOME_BACK_THRESHOLD_MS) return null;

  const cropStatuses = game.plots
    .filter((plot) => plot.crop)
    .map((plot) => getCropStatus(plot, now));

  const weather = getWeather(now);
  const critterTraceThreshold = BALANCE_PRESETS[game.balanceId]?.critterTraceOfflineMs ?? BALANCE_PRESETS.demo.critterTraceOfflineMs;

  return {
    offlineMs,
    readyCrops: cropStatuses.filter((status) => status.isReady && !status.wilted).length,
    wiltedCrops: cropStatuses.filter((status) => status.wilted).length,
    gatherRefilled: game.gather.charges < 2 && now - game.gather.lastRefillAt >= GATHER_REFILL_MS,
    dailyReward: game.lastLoginDate !== getDayKey(now),
    weatherNotice: weather === "clear" ? "오늘은 맑습니다." : `오늘은 ${getWeatherName(weather)} 소식이 있습니다.`,
    critterTrace: offlineMs >= critterTraceThreshold ? getCritterTrace(game, offlineMs, now) : null,
    compostReadyCount: getCompostReadyCount(game, now),
  };
}

function bootGame(): { game: GameState; messages: string[]; welcomeSummary: WelcomeSummary | null } {
  const now = Date.now();
  const game = mergeSavedState(migrate(readSave()), now);
  const welcomeSummary = buildWelcomeSummary(game, now);
  const messages: string[] = [];

  applyOfflineGrowthCap(game, now);
  messages.push(...applyDailyLogin(game, now));
  const weatherMessage = applyDailyWeatherEffects(game, now);
  if (weatherMessage) messages.push(weatherMessage);
  if (applyGatherRefill(game, now)) {
    messages.push("숲 입구 채집 기회가 다시 채워졌습니다.");
  }
  ensureDailyVisitor(game, now);
  writeSave(game);
  return { game, messages, welcomeSummary };
}

export interface Toast {
  id: number;
  message: string;
}

interface GameStore {
  game: GameState;
  now: number;
  toasts: Toast[];
  welcomeSummary: WelcomeSummary | null;
  harvestEffects: HarvestEffect[];
  careEffects: CareEffect[];
  activeCritters: ActiveCritter[];
  nearbyInteraction: InteractionPrompt | null;
  selectedForage: number | null;
  placementDecorationId: string | null;
  playerSpawn: { id: PlayerSpawnId; version: number };
  interactionCooldownUntil: number;
  showToast: (message: string) => void;
  dismissWelcome: () => void;
  switchScene: (scene: SceneId) => void;
  selectSeed: (cropId: string) => void;
  clickPlot: (index: number) => void;
  selectPlot: (index: number) => void;
  selectForage: (index: number) => void;
  setNearbyInteraction: (prompt: InteractionPrompt | null) => void;
  performNearbyInteraction: () => void;
  performPlotAction: (index: number) => void;
  performForageAction: (index: number) => void;
  buySeed: (cropId: string) => void;
  sellItem: (key: string) => void;
  sellAll: () => void;
  deliverVisitorOrder: () => void;
  collectForage: (index: number) => void;
  startGatherRound: () => void;
  claimReward: (rewardId: string) => void;
  useGoldenWater: (index: number) => void;
  useFertilizer: (index: number) => void;
  craftFertilizer: () => void;
  buyDecoration: (type: DecorationType) => void;
  startDecorationPlacement: (id: string) => void;
  cancelDecorationPlacement: () => void;
  placeDecoration: (id: string, x: number, z: number, rotY: number) => void;
  pickupDecoration: (id: string) => void;
  observeCritter: (id: string) => void;
  addWiltedToCompost: () => void;
  collectCompost: (index: number) => void;
  performCompostAction: () => void;
  resetGame: () => void;
}

let nextToastId = 1;
let nextEffectId = 1;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function getCritterCheckDelay(game: GameState): number {
  const balance = BALANCE_PRESETS[game.balanceId] ?? BALANCE_PRESETS.demo;
  return randomBetween(balance.critterCheckMinMs, balance.critterCheckMaxMs);
}

function getCritterStayMs(game: GameState): number {
  const balance = BALANCE_PRESETS[game.balanceId] ?? BALANCE_PRESETS.demo;
  return randomBetween(balance.critterStayMinMs, balance.critterStayMaxMs);
}

function randomCritterSpawn(type: CritterType): { x: number; z: number } {
  if (type === "owl") {
    return Math.random() > 0.5 ? { x: -3.75, z: -0.75 } : { x: 3.75, z: 0.75 };
  }

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = randomBetween(1.8, 3.45);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const nearPlotGrid = Math.abs(x) < 2.35 && Math.abs(z) < 2.35;
    if (!nearPlotGrid) return { x, z };
  }

  return { x: 2.7, z: -2.3 };
}

function makeActiveCritter(type: CritterType, game: GameState, now = Date.now()): ActiveCritter {
  const position = randomCritterSpawn(type);
  return {
    id: `critter-${type}-${now}-${Math.floor(Math.random() * 100000)}`,
    type,
    spawnedAt: now,
    leaveAt: now + getCritterStayMs(game),
    seed: Math.random() * 1000,
    x: position.x,
    z: position.z,
    heartPulse: 0,
  };
}

export const useGameStore = create<GameStore>((set, get) => {
  const { game, messages, welcomeSummary } = bootGame();
  let nextCritterCheckAt = Date.now() + getCritterCheckDelay(game);

  const commit = (next: GameState) => {
    writeSave(next);
    set({ game: next });
  };

  const showToast = (message: string) => {
    const id = nextToastId++;
    set((store) => ({ toasts: [...store.toasts, { id, message }] }));
    window.setTimeout(() => {
      set((store) => ({ toasts: store.toasts.filter((toast) => toast.id !== id) }));
    }, 3600);
  };

  const addHarvestEffect = (effect: HarvestEffect) => {
    set((store) => ({ harvestEffects: [...store.harvestEffects, effect] }));
    window.setTimeout(() => {
      set((store) => ({ harvestEffects: store.harvestEffects.filter((item) => item.id !== effect.id) }));
    }, 900);
  };

  const addCareEffect = (effect: CareEffect) => {
    set((store) => ({ careEffects: [...store.careEffects, effect] }));
    window.setTimeout(() => {
      set((store) => ({ careEffects: store.careEffects.filter((item) => item.id !== effect.id) }));
    }, 820);
  };

  const addSeed = (next: GameState, cropId: string, amount: number) => {
    next.seeds[cropId] = (next.seeds[cropId] || 0) + amount;
  };

  const isTargetNearby = (target: InteractionTarget) => isSameTarget(get().nearbyInteraction?.target ?? null, target);

  const requireNearby = (target: InteractionTarget): boolean => {
    if (isTargetNearby(target)) return true;
    showToast("가까이 가야 합니다.");
    return false;
  };

  const spawnForScene = (scene: SceneId): PlayerSpawnId => (scene === "garden" ? "garden-from-forest" : "forest-from-garden");

  const switchSceneTo = (scene: SceneId) => {
    if (!["garden", "forest"].includes(scene)) return;
    const current = get().game;
    if (current.scene === scene) return;
    const next = structuredClone(current);
    next.scene = scene;
    writeSave(next);
    set((store) => ({
      game: next,
      nearbyInteraction: null,
      selectedForage: null,
      placementDecorationId: null,
      playerSpawn: { id: spawnForScene(scene), version: store.playerSpawn.version + 1 },
      interactionCooldownUntil: Date.now() + SCENE_INTERACTION_COOLDOWN_MS,
    }));
  };

  const harvestInto = (next: GameState, index: number, now: number): { effect: HarvestEffect; message: string } | null => {
    const plot = next.plots[index];
    if (!plot?.crop) return null;

    const status = getCropStatus(plot, now);
    if (!status.isReady) {
      showToast(`아직 ${formatDuration(status.remaining)} 더 기다려야 합니다.`);
      return null;
    }

    const quality: QualityId = status.wilted
      ? "wilted"
      : rollQuality(Boolean(plot.crop.watered), Boolean(plot.crop.fertilized));
    const key = makeItemKey("crop", plot.crop.type, quality);
    addInventory(next, key, 1);
    addCodex(next, key, now);
    plot.crop = null;
    next.selectedPlot = index;

    const qualityName = QUALITY_DEFS[quality].name;
    return {
      effect: {
        id: nextEffectId++,
        plotIndex: index,
        cropType: status.def.id,
        quality,
        label: `+1 ${status.def.name} (${qualityName})`,
      },
      message: `${status.def.name} ${qualityName} 품질을 수확했습니다.`,
    };
  };

  const runPlotAction = (index: number, checkNearby: boolean) => {
    const target: InteractionTarget = { kind: "plot", index };
    if (checkNearby && !requireNearby(target)) return;

    const now = Date.now();
    const next = structuredClone(get().game);
    const plot = next.plots[index];
    if (!plot) return;
    next.selectedPlot = index;

    if (!plot.unlocked) {
      const cost = PLOT_UNLOCK_COSTS[index] || 0;
      if (next.gold < cost) {
        showToast(`밭을 열려면 ${cost}G가 필요합니다.`);
        commit(next);
        return;
      }
      next.gold -= cost;
      plot.unlocked = true;
      showToast(`새 밭을 열었습니다. (-${cost}G)`);
      commit(next);
      return;
    }

    if (!plot.crop) {
      const crop = CROP_DEFS[next.selectedSeed];
      if ((next.seeds[crop.id] || 0) <= 0) {
        showToast(`${crop.name} 씨앗이 없습니다. 상점에서 씨앗을 사 주세요.`);
        commit(next);
        return;
      }
      next.seeds[crop.id] -= 1;
      plot.crop = {
        type: crop.id,
        plantedAt: now,
        boostMs: 0,
        watered: getWeather(now) !== "clear",
        fertilized: false,
      };
      showToast(getWeather(now) !== "clear" ? `${crop.name}을 심었습니다. 날씨 덕분에 흙이 이미 촉촉합니다.` : `${crop.name}을 심었습니다.`);
      commit(next);
      return;
    }

    const status = getCropStatus(plot, now);
    if (!status.isReady) {
      if (!plot.crop.watered) {
        plot.crop.watered = true;
        showToast(`${status.def.name}에 물을 주었습니다. 좋은 품질 확률이 올랐습니다.`);
        commit(next);
        addCareEffect({ id: nextEffectId++, plotIndex: index, kind: "water" });
        return;
      }

      showToast(`${status.def.name}이 자라는 중입니다. 남은 시간은 ${formatDuration(status.remaining)}입니다.`);
      commit(next);
      return;
    }

    const result = harvestInto(next, index, now);
    if (!result) return;
    showToast(result.message);
    commit(next);
    addHarvestEffect(result.effect);
  };

  const runForageAction = (index: number, checkNearby: boolean) => {
    const target: InteractionTarget = { kind: "forage", index };
    if (checkNearby && !requireNearby(target)) return;

    const now = Date.now();
    const next = structuredClone(get().game);
    const spot = next.gather.spots[index];
    if (!spot || spot.collected) return;

    spot.collected = true;
    next.selectedPlot = null;
    const key = makeItemKey("forage", spot.item, "normal");
    addInventory(next, key, 1);
    addCodex(next, key, now);
    showToast(`${getItemInfo(key).name}을 주웠습니다.`);
    commit(next);
  };

  const runTargetInteraction = (target: InteractionTarget, checkNearby: boolean) => {
    if (target.kind === "portal") {
      if (checkNearby && !requireNearby(target)) return;
      switchSceneTo(target.to);
      return;
    }
    if (target.kind === "decoration") {
      if (checkNearby && !requireNearby(target)) return;
      get().pickupDecoration(target.id);
      return;
    }
    if (target.kind === "compost") {
      if (checkNearby && !requireNearby(target)) return;
      get().performCompostAction();
      return;
    }
    if (target.kind === "critter") {
      if (checkNearby && !requireNearby(target)) return;
      get().observeCritter(target.id);
      return;
    }
    if (target.kind === "plot") {
      runPlotAction(target.index, checkNearby);
      return;
    }
    runForageAction(target.index, checkNearby);
  };

  window.setInterval(() => {
    const now = Date.now();
    set({ now });

    const current = get().game;
    const activeCritters = get().activeCritters;
    const livingCritters = activeCritters.filter((critter) => critter.leaveAt > now);
    if (livingCritters.length !== activeCritters.length) {
      set({ activeCritters: livingCritters });
    }

    if (now >= nextCritterCheckAt) {
      nextCritterCheckAt = now + getCritterCheckDelay(current);
      const currentActive = get().activeCritters;
      const chance = Math.min(0.65, 0.35 + getCoziness(current) * 0.01);
      if (current.scene === "garden" && currentActive.length < 2 && Math.random() < chance) {
        const type = pickCritterType(current, now);
        if (type) {
          set({ activeCritters: [...currentActive, makeActiveCritter(type, current, now)] });
          showToast(`${CRITTER_DEFS[type].name}가 정원에 찾아왔습니다.`);
        }
      }
    }

    const needsRefill =
      current.gather.lastRefillAt > now ||
      (current.gather.charges < 2 && now - current.gather.lastRefillAt >= GATHER_REFILL_MS);
    const needsVisitor =
      !current.dailyVisitor ||
      current.dailyVisitor.date !== getDayKey(now) ||
      current.dailyVisitor.bonus !== 1.5;
    const needsWeather = getWeather(now) !== "clear" && current.lastRainWateredDate !== getDayKey(now);
    if (!needsRefill && !needsVisitor && !needsWeather) return;

    const next = structuredClone(current);
    let changed = applyGatherRefill(next, now);
    if (ensureDailyVisitor(next, now)) changed = true;
    const weatherMessage = applyDailyWeatherEffects(next, now);
    if (weatherMessage) {
      changed = true;
      showToast(weatherMessage);
    }
    if (changed) commit(next);
  }, 1000);

  window.setTimeout(() => {
    messages.forEach(showToast);
  }, 400);

  return {
    game,
    now: Date.now(),
    toasts: [],
    welcomeSummary,
    harvestEffects: [],
    careEffects: [],
    activeCritters: [],
    nearbyInteraction: null,
    selectedForage: null,
    placementDecorationId: null,
    playerSpawn: { id: "garden-default", version: 0 },
    interactionCooldownUntil: 0,
    showToast,

    dismissWelcome: () => {
      set({ welcomeSummary: null });
    },

    switchScene: (scene) => {
      switchSceneTo(scene);
    },

    selectSeed: (cropId) => {
      if (!CROP_DEFS[cropId]) return;
      const next = structuredClone(get().game);
      next.selectedSeed = cropId;
      commit(next);
    },

    clickPlot: (index) => {
      get().selectPlot(index);
    },

    selectPlot: (index) => {
      const next = structuredClone(get().game);
      const plot = next.plots[index];
      if (!plot) return;
      next.selectedPlot = index;
      commit(next);
      set({ selectedForage: null });
    },

    selectForage: (index) => {
      const spot = get().game.gather.spots[index];
      if (!spot) return;
      set({ selectedForage: index });
    },

    setNearbyInteraction: (prompt) => {
      const current = get();
      const samePrompt =
        current.nearbyInteraction?.targetKey === prompt?.targetKey &&
        current.nearbyInteraction?.action === prompt?.action &&
        current.nearbyInteraction?.label === prompt?.label;
      const nextSelectedPlot = prompt?.target.kind === "plot" ? prompt.target.index : current.game.selectedPlot;
      const nextSelectedForage = prompt?.target.kind === "forage" ? prompt.target.index : current.selectedForage;
      const plotUnchanged = current.game.selectedPlot === nextSelectedPlot;
      const forageUnchanged = current.selectedForage === nextSelectedForage;
      if (samePrompt && plotUnchanged && forageUnchanged) return;

      const nextGame = plotUnchanged ? current.game : { ...current.game, selectedPlot: nextSelectedPlot };
      set({
        game: nextGame,
        nearbyInteraction: prompt,
        selectedForage: nextSelectedForage,
      });
    },

    performNearbyInteraction: () => {
      if (Date.now() < get().interactionCooldownUntil) return;
      const prompt = get().nearbyInteraction;
      if (!prompt) return;
      runTargetInteraction(prompt.target, true);
    },

    performPlotAction: (index) => {
      runPlotAction(index, true);
    },

    performForageAction: (index) => {
      runForageAction(index, true);
    },

    buySeed: (cropId) => {
      const crop = CROP_DEFS[cropId];
      if (!crop) return;

      const next = structuredClone(get().game);
      if (crop.unlockCodex && getCodexCount(next) < crop.unlockCodex) {
        showToast(`도감 ${crop.unlockCodex}칸을 채우면 ${crop.name} 씨앗이 열립니다.`);
        return;
      }
      if (next.gold < crop.seedCost) {
        showToast("골드가 부족합니다. 수확물이나 채집물을 판매해 보세요.");
        return;
      }

      next.gold -= crop.seedCost;
      addSeed(next, cropId, 1);
      next.selectedSeed = cropId;
      showToast(`${crop.name} 씨앗을 1개 샀습니다.`);
      commit(next);
    },

    sellItem: (key) => {
      const next = structuredClone(get().game);
      const quantity = next.inventory[key] || 0;
      if (quantity <= 0) return;

      const item = getItemInfo(key);
      next.inventory[key] -= 1;
      if (next.inventory[key] <= 0) delete next.inventory[key];
      next.gold += item.sellPrice;
      showToast(`${item.name}을 판매하고 ${item.sellPrice}G를 받았습니다.`);
      commit(next);
    },

    sellAll: () => {
      const next = structuredClone(get().game);
      const entries = Object.entries(next.inventory).filter(([, quantity]) => quantity > 0);
      if (entries.length === 0) {
        showToast("판매할 아이템이 없습니다.");
        return;
      }

      const total = entries.reduce((sum, [key, quantity]) => sum + getItemInfo(key).sellPrice * quantity, 0);
      next.inventory = {};
      next.gold += total;
      showToast(`인벤토리를 정리하고 ${total}G를 받았습니다.`);
      commit(next);
    },

    deliverVisitorOrder: () => {
      const next = structuredClone(get().game);
      const visitor = next.dailyVisitor;
      if (!visitor || visitor.done) return;

      const key = findInventoryCropKey(next, visitor.cropType);
      if (!key) {
        showToast(`${CROP_DEFS[visitor.cropType].name} 수확물이 필요합니다.`);
        return;
      }

      const item = getItemInfo(key);
      const reward = Math.round(item.sellPrice * getVisitorBonus(next));
      next.inventory[key] -= 1;
      if (next.inventory[key] <= 0) delete next.inventory[key];
      next.gold += reward;
      visitor.done = true;
      showToast(`${visitor.name}의 요청을 완료하고 ${reward}G를 받았습니다.`);
      commit(next);
    },

    collectForage: (index) => {
      runForageAction(index, true);
    },

    startGatherRound: () => {
      const next = structuredClone(get().game);
      if (next.gather.charges <= 0) {
        showToast(`다음 채집 리필까지 ${formatDuration(getGatherRemainingMs(next, Date.now()))} 남았습니다.`);
        return;
      }

      next.gather.charges -= 1;
      next.gather.spots = makeGatherSpots(Date.now());
      showToast("새 채집 포인트가 반짝이기 시작했습니다.");
      commit(next);
    },

    claimReward: (rewardId) => {
      const next = structuredClone(get().game);
      const reward = CODEX_REWARDS.find((item) => item.id === rewardId);
      if (!reward || next.claimedRewards.includes(rewardId) || getCodexCount(next) < reward.required) return;

      if (rewardId === "3") {
        addSeed(next, "tomato", 2);
        addSeed(next, "strawberry", 1);
      }
      if (rewardId === "6") {
        next.gold += 140;
        next.goldenWater = Math.min(3, next.goldenWater + 1);
      }
      if (rewardId === "10") {
        addSeed(next, "watermelon", 1);
        addSeed(next, "moon_mushroom", 1);
        addSeed(next, "rainbow_flower", 1);
        next.gold += 220;
      }
      if (rewardId === "20") {
        next.gold += 500;
        next.goldenWater = Math.min(3, next.goldenWater + 1);
      }

      next.claimedRewards.push(rewardId);
      showToast(`${reward.title}을 받았습니다.`);
      commit(next);
    },

    useGoldenWater: (index) => {
      if (!requireNearby({ kind: "plot", index })) return;
      const now = Date.now();
      const next = structuredClone(get().game);
      const plot = next.plots[index];
      if (!plot?.crop) return;

      const status = getCropStatus(plot, now);
      if (status.isReady) {
        showToast("이미 다 자란 작물입니다.");
        return;
      }
      if (next.goldenWater <= 0) {
        showToast("오늘 사용할 황금 물뿌리개가 없습니다.");
        return;
      }

      const boost = Math.max(15 * 1000, Math.floor(status.def.growMs * 0.35));
      plot.crop.boostMs = Math.min(status.def.growMs, (plot.crop.boostMs || 0) + boost);
      plot.crop.watered = true;
      next.goldenWater -= 1;
      next.selectedPlot = index;
      showToast(`${status.def.name}의 성장 시간이 줄고 좋은 품질 확률이 올랐습니다.`);
      commit(next);
      addCareEffect({ id: nextEffectId++, plotIndex: index, kind: "water" });
    },

    useFertilizer: (index) => {
      if (!requireNearby({ kind: "plot", index })) return;
      const next = structuredClone(get().game);
      const plot = next.plots[index];
      if (!plot?.crop) return;

      const status = getCropStatus(plot, Date.now());
      if (status.isReady) {
        showToast("다 자란 작물에는 비료를 쓸 수 없습니다.");
        return;
      }
      if (plot.crop.fertilized) {
        showToast("이미 비료를 준 작물입니다.");
        return;
      }
      if (next.fertilizer <= 0) {
        showToast("사용할 비료가 없습니다.");
        return;
      }

      plot.crop.fertilized = true;
      next.fertilizer -= 1;
      next.selectedPlot = index;
      showToast(`${status.def.name}에 비료를 주었습니다. 품질 확률이 크게 올랐습니다.`);
      commit(next);
      addCareEffect({ id: nextEffectId++, plotIndex: index, kind: "fertilizer" });
    },

    craftFertilizer: () => {
      const next = structuredClone(get().game);
      const recipeEntries = Object.entries(FERTILIZER_RECIPE);
      const canCraft = recipeEntries.every(([itemId, amount]) => {
        const key = makeItemKey("forage", itemId, "normal");
        return (next.inventory[key] || 0) >= amount;
      });

      if (!canCraft) {
        showToast("비료를 만들 재료가 부족합니다. 작은 버섯 2개와 들꽃 1개가 필요합니다.");
        return;
      }

      recipeEntries.forEach(([itemId, amount]) => {
        const key = makeItemKey("forage", itemId, "normal");
        next.inventory[key] -= amount;
        if (next.inventory[key] <= 0) delete next.inventory[key];
      });
      next.fertilizer += 1;
      showToast("채집물로 비료 1개를 만들었습니다.");
      commit(next);
    },

    buyDecoration: (type) => {
      const decor = DECOR_DEFS[type];
      if (!decor) return;

      const next = structuredClone(get().game);
      if (next.gold < decor.cost) {
        showToast("장식을 사기엔 골드가 부족합니다.");
        return;
      }

      next.gold -= decor.cost;
      next.decorations.push({
        id: makeDecorationId(type),
        type,
        x: null,
        z: null,
        rotY: 0,
      });
      showToast(`${decor.name}을 샀습니다. 보유 목록에서 배치할 수 있습니다.`);
      commit(next);
    },

    startDecorationPlacement: (id) => {
      const current = get().game;
      const decoration = current.decorations.find((item) => item.id === id);
      if (!decoration) return;
      if (decoration.x !== null && decoration.z !== null) {
        showToast("이미 설치된 장식입니다.");
        return;
      }

      if (current.scene !== "garden") switchSceneTo("garden");
      set({ placementDecorationId: id, nearbyInteraction: null });
      showToast(`${DECOR_DEFS[decoration.type].name} 배치 모드입니다. E로 설치하고 ESC로 취소합니다.`);
    },

    cancelDecorationPlacement: () => {
      if (!get().placementDecorationId) return;
      set({ placementDecorationId: null });
      showToast("장식 배치를 취소했습니다.");
    },

    placeDecoration: (id, x, z, rotY) => {
      const next = structuredClone(get().game);
      const decoration = next.decorations.find((item) => item.id === id);
      if (!decoration) return;
      decoration.x = x;
      decoration.z = z;
      decoration.rotY = rotY;
      showToast(`${DECOR_DEFS[decoration.type].name}을 설치했습니다.`);
      commit(next);
      set({ placementDecorationId: null });
    },

    pickupDecoration: (id) => {
      if (!requireNearby({ kind: "decoration", id })) return;
      const next = structuredClone(get().game);
      const decoration = next.decorations.find((item) => item.id === id);
      if (!decoration) return;

      decoration.x = null;
      decoration.z = null;
      decoration.rotY = 0;
      showToast(`${DECOR_DEFS[decoration.type].name}을 회수했습니다.`);
      commit(next);
      set({ nearbyInteraction: null });
    },

    observeCritter: (id) => {
      const critter = get().activeCritters.find((item) => item.id === id);
      if (!critter) return;

      const key = makeItemKey("critter", critter.type, "normal");
      const current = get().game;
      const firstObservation = !current.codex[key];
      if (firstObservation) {
        const next = structuredClone(current);
        addCodex(next, key, Date.now());
        next.gold += 30;
        commit(next);
      }

      set((store) => ({
        activeCritters: store.activeCritters.map((item) => (item.id === id ? { ...item, heartPulse: item.heartPulse + 1 } : item)),
      }));
      showToast(firstObservation ? `${CRITTER_DEFS[critter.type].name}를 도감에 기록하고 30G를 받았습니다.` : `${CRITTER_DEFS[critter.type].name}가 반가워합니다.`);
    },

    addWiltedToCompost: () => {
      if (!requireNearby({ kind: "compost" })) return;
      const next = structuredClone(get().game);
      if (!hasEmptyCompostSlot(next)) {
        showToast("퇴비함 슬롯이 가득 찼습니다.");
        return;
      }

      const itemKey = findWiltedInventoryKey(next);
      if (!itemKey) {
        showToast("넣을 시든 작물이 없습니다.");
        return;
      }

      const slotIndex = next.compost.slots.findIndex((slot) => slot === null);
      next.inventory[itemKey] -= 1;
      if (next.inventory[itemKey] <= 0) delete next.inventory[itemKey];
      next.compost.slots[slotIndex] = { itemKey, startedAt: Date.now() };
      showToast("시든 작물을 퇴비함에 넣었습니다.");
      commit(next);
    },

    collectCompost: (index) => {
      if (!requireNearby({ kind: "compost" })) return;
      const next = structuredClone(get().game);
      const slot = next.compost.slots[index];
      if (!slot) return;

      const remaining = getCompostRemainingMs(slot, Date.now());
      if (remaining > 0) {
        showToast(`퇴비가 완성되려면 ${formatDuration(remaining)} 남았습니다.`);
        return;
      }

      next.compost.slots[index] = null;
      next.fertilizer += 1;
      showToast("완성된 퇴비를 비료 1개로 수거했습니다.");
      commit(next);
    },

    performCompostAction: () => {
      const game = get().game;
      const readyIndex = game.compost.slots.findIndex((slot) => slot && getCompostRemainingMs(slot, Date.now()) <= 0);
      if (readyIndex >= 0) {
        get().collectCompost(readyIndex);
        return;
      }
      get().addWiltedToCompost();
    },

    resetGame: () => {
      const confirmed = window.confirm("현재 저장된 정원을 지우고 처음부터 시작할까요?");
      if (!confirmed) return;

      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch (error) {
        console.warn("Save data could not be cleared.", error);
      }

      const now = Date.now();
      const fresh = createDefaultState(now);
      applyDailyLogin(fresh, now);
      applyDailyWeatherEffects(fresh, now);
      ensureDailyVisitor(fresh, now);
      writeSave(fresh);
      nextCritterCheckAt = now + getCritterCheckDelay(fresh);
      set({
        game: fresh,
        now,
        welcomeSummary: null,
        harvestEffects: [],
        careEffects: [],
        activeCritters: [],
        nearbyInteraction: null,
        selectedForage: null,
        placementDecorationId: null,
        playerSpawn: { id: "garden-default", version: 0 },
        interactionCooldownUntil: 0,
      });
      showToast("새 정원을 시작했습니다.");
    },
  };
});
