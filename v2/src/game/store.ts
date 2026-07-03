import { create } from "zustand";
import { CROP_DEFS, GATHER_REFILL_MS, PLOT_UNLOCK_COSTS, QUALITY_DEFS, SAVE_KEY } from "./data";
import {
  addCodex,
  addInventory,
  applyDailyLogin,
  applyGatherRefill,
  applyOfflineGrowthCap,
  ensureDailyVisitor,
  formatDuration,
  getCropStatus,
  getDayKey,
  makeItemKey,
  mergeSavedState,
  rollQuality,
} from "./logic";
import type { GameState } from "./types";

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

function bootGame(): { game: GameState; messages: string[] } {
  const now = Date.now();
  const game = mergeSavedState(readSave(), now);
  const messages: string[] = [];
  applyOfflineGrowthCap(game, now);
  messages.push(...applyDailyLogin(game, now));
  if (applyGatherRefill(game, now)) {
    messages.push("숲 입구 채집 기회가 다시 채워졌습니다.");
  }
  ensureDailyVisitor(game, now);
  writeSave(game);
  return { game, messages };
}

export interface Toast {
  id: number;
  message: string;
}

interface GameStore {
  game: GameState;
  now: number;
  toasts: Toast[];
  showToast: (message: string) => void;
  selectSeed: (cropId: string) => void;
  clickPlot: (index: number) => void;
}

let nextToastId = 1;

export const useGameStore = create<GameStore>((set, get) => {
  const { game, messages } = bootGame();

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
    showToast,

    selectSeed: (cropId) => {
      if (!CROP_DEFS[cropId]) return;
      const next = structuredClone(get().game);
      next.selectedSeed = cropId;
      commit(next);
    },

    clickPlot: (index) => {
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
        };
        showToast(`${crop.name}을 심었습니다.`);
        commit(next);
        return;
      }

      const status = getCropStatus(plot, now);
      if (!status.isReady) {
        showToast(`${status.def.name}이 자라는 중입니다. 남은 시간은 ${formatDuration(status.remaining)}입니다.`);
        commit(next);
        return;
      }

      const quality = status.wilted ? "wilted" : rollQuality(Boolean(plot.crop.watered));
      const key = makeItemKey("crop", plot.crop.type, quality);
      addInventory(next, key, 1);
      addCodex(next, key, now);
      plot.crop = null;
      showToast(`${status.def.name} ${QUALITY_DEFS[quality].name} 품질을 수확했습니다.`);
      commit(next);
    },
  };
});
