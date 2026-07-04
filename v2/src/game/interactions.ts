import { CRITTER_DEFS, CROP_DEFS, FORAGE_DEFS, PET_DEFS, PLOT_UNLOCK_COSTS } from "./data";
import { findWiltedInventoryKey, formatDuration, getCompostRemainingMs, getCropStatus, hasEmptyCompostSlot } from "./logic";
import type { GameState, InteractionPrompt, InteractionTarget } from "./types";

export function getTargetKey(target: InteractionTarget): string {
  if (target.kind === "plot") return `plot:${target.index}`;
  if (target.kind === "forage") return `forage:${target.index}`;
  if (target.kind === "decoration") return `decoration:${target.id}`;
  if (target.kind === "compost") return "compost";
  if (target.kind === "critter") return `critter:${target.id}`;
  if (target.kind === "pet") return `pet:${target.id}`;
  if (target.kind === "fishingSpot") return "fishingSpot";
  return `portal:${target.id}`;
}

export function isSameTarget(left: InteractionTarget | null, right: InteractionTarget | null): boolean {
  if (!left || !right) return left === right;
  return getTargetKey(left) === getTargetKey(right);
}

export function getInteractionPrompt(game: GameState, target: InteractionTarget, now: number): InteractionPrompt | null {
  if (target.kind === "portal") {
    return {
      target,
      targetKey: getTargetKey(target),
      action: "portal",
      label: target.to === "forest" ? "숲 입구로 가기" : "정원으로 돌아가기",
    };
  }

  if (target.kind === "forage") {
    const spot = game.gather.spots[target.index];
    if (!spot || spot.collected) return null;
    return {
      target,
      targetKey: getTargetKey(target),
      action: "collect",
      label: `${FORAGE_DEFS[spot.item].name} 채집`,
    };
  }

  if (target.kind === "decoration") {
    return {
      target,
      targetKey: getTargetKey(target),
      action: "pickup",
      label: "장식 회수",
    };
  }

  if (target.kind === "compost") {
    const readySlot = game.compost.slots.find((slot) => slot && getCompostRemainingMs(slot, now) <= 0);
    const canAdd = hasEmptyCompostSlot(game) && Boolean(findWiltedInventoryKey(game));
    return {
      target,
      targetKey: getTargetKey(target),
      action: "compost",
      label: readySlot ? "퇴비 수거" : canAdd ? "시든 작물 넣기" : "퇴비함 확인",
    };
  }

  if (target.kind === "critter") {
    return {
      target,
      targetKey: getTargetKey(target),
      action: "observe",
      label: `${CRITTER_DEFS[target.type].name} 관찰`,
    };
  }

  if (target.kind === "pet") {
    return {
      target,
      targetKey: getTargetKey(target),
      action: "pet",
      label: `${PET_DEFS[target.id].name} 쓰다듬기`,
    };
  }

  if (target.kind === "fishingSpot") {
    return {
      target,
      targetKey: getTargetKey(target),
      action: "fish",
      label: game.bait > 0 ? "낚시하기" : "미끼 없음",
    };
  }

  const plot = game.plots[target.index];
  if (!plot) return null;

  if (!plot.unlocked) {
    return {
      target,
      targetKey: getTargetKey(target),
      action: "unlock",
      label: `${PLOT_UNLOCK_COSTS[target.index] || 0}G로 확장`,
    };
  }

  if (!plot.crop) {
    const crop = CROP_DEFS[game.selectedSeed];
    return {
      target,
      targetKey: getTargetKey(target),
      action: "plant",
      label: `${crop.name} 심기`,
    };
  }

  const status = getCropStatus(plot, now);
  if (status.isReady) {
    return {
      target,
      targetKey: getTargetKey(target),
      action: "harvest",
      label: status.wilted ? "시든 작물 수확" : `${status.def.name} 수확`,
    };
  }

  if (!plot.crop.watered) {
    return {
      target,
      targetKey: getTargetKey(target),
      action: "water",
      label: `${status.def.name} 물주기`,
    };
  }

  return {
    target,
    targetKey: getTargetKey(target),
    action: "wait",
    label: `남은 시간 ${formatDuration(status.remaining)}`,
  };
}
