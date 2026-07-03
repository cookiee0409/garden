import { create } from "zustand";
import { CODEX_REWARDS, CROP_DEFS, FERTILIZER_RECIPE, GATHER_REFILL_MS, PLOT_UNLOCK_COSTS, QUALITY_DEFS, SAVE_KEY } from "./data";
import { isSameTarget } from "./interactions";
import {
  addCodex,
  addInventory,
  applyDailyLogin,
  applyGatherRefill,
  applyOfflineGrowthCap,
  createDefaultState,
  ensureDailyVisitor,
  findInventoryCropKey,
  formatDuration,
  getCodexCount,
  getCropStatus,
  getDayKey,
  getGatherRemainingMs,
  getItemInfo,
  makeGatherSpots,
  makeItemKey,
  mergeSavedState,
  rollQuality,
} from "./logic";
import { migrate } from "./save";
import type {
  CareEffect,
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

  return {
    offlineMs,
    readyCrops: cropStatuses.filter((status) => status.isReady && !status.wilted).length,
    wiltedCrops: cropStatuses.filter((status) => status.wilted).length,
    gatherRefilled: game.gather.charges < 2 && now - game.gather.lastRefillAt >= GATHER_REFILL_MS,
    dailyReward: game.lastLoginDate !== getDayKey(now),
  };
}

function bootGame(): { game: GameState; messages: string[]; welcomeSummary: WelcomeSummary | null } {
  const now = Date.now();
  const game = mergeSavedState(migrate(readSave()), now);
  const welcomeSummary = buildWelcomeSummary(game, now);
  const messages: string[] = [];

  applyOfflineGrowthCap(game, now);
  messages.push(...applyDailyLogin(game, now));
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
  nearbyInteraction: InteractionPrompt | null;
  selectedForage: number | null;
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
  resetGame: () => void;
}

let nextToastId = 1;
let nextEffectId = 1;

export const useGameStore = create<GameStore>((set, get) => {
  const { game, messages, welcomeSummary } = bootGame();

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
        watered: false,
        fertilized: false,
      };
      showToast(`${crop.name}을 심었습니다.`);
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
    const needsRefill =
      current.gather.lastRefillAt > now ||
      (current.gather.charges < 2 && now - current.gather.lastRefillAt >= GATHER_REFILL_MS);
    const needsVisitor =
      !current.dailyVisitor ||
      current.dailyVisitor.date !== getDayKey(now) ||
      current.dailyVisitor.bonus !== 1.5;
    if (!needsRefill && !needsVisitor) return;

    const next = structuredClone(current);
    let changed = applyGatherRefill(next, now);
    if (ensureDailyVisitor(next, now)) changed = true;
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
    nearbyInteraction: null,
    selectedForage: null,
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
      const reward = Math.round(item.sellPrice * visitor.bonus);
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
      ensureDailyVisitor(fresh, now);
      writeSave(fresh);
      set({
        game: fresh,
        now,
        welcomeSummary: null,
        harvestEffects: [],
        careEffects: [],
        nearbyInteraction: null,
        selectedForage: null,
        playerSpawn: { id: "garden-default", version: 0 },
        interactionCooldownUntil: 0,
      });
      showToast("새 정원을 시작했습니다.");
    },
  };
});
