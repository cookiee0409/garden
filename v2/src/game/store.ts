import { create } from "zustand";
import { SAVE_KEY } from "./data";
import {
  applyDailyLogin,
  applyGatherRefill,
  applyOfflineGrowthCap,
  ensureDailyVisitor,
  mergeSavedState,
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

interface GameStore {
  game: GameState;
  bootMessages: string[];
  mutate: (fn: (game: GameState) => void) => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  const { game, messages } = bootGame();
  return {
    game,
    bootMessages: messages,
    mutate: (fn) => {
      const next = structuredClone(get().game);
      fn(next);
      writeSave(next);
      set({ game: next });
    },
  };
});
