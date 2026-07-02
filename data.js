(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GardenData = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SAVE_KEY = "mini-idle-garden-save-v1";
  const OFFLINE_GROWTH_CAP_MS = 12 * 60 * 60 * 1000;
  const WILT_AFTER_MS = 45 * 60 * 1000;
  const GATHER_REFILL_MS = 5 * 60 * 1000;

  const CROP_DEFS = {
    tomato: {
      id: "tomato",
      name: "방울토마토",
      seedCost: 10,
      sellPrice: 25,
      growMs: 45 * 1000,
      className: "tomato",
      tier: 1,
      note: "가볍게 돌리는 첫 작물",
    },
    carrot: {
      id: "carrot",
      name: "당근",
      seedCost: 14,
      sellPrice: 34,
      growMs: 75 * 1000,
      className: "carrot",
      tier: 1,
      note: "초반 골드 벌이용",
    },
    strawberry: {
      id: "strawberry",
      name: "딸기",
      seedCost: 50,
      sellPrice: 140,
      growMs: 4 * 60 * 1000,
      className: "strawberry",
      tier: 2,
      note: "하루 두 번 접속 리듬의 중심",
    },
    sunflower: {
      id: "sunflower",
      name: "해바라기",
      seedCost: 70,
      sellPrice: 190,
      growMs: 6 * 60 * 1000,
      className: "sunflower",
      tier: 2,
      note: "조금 더 긴 호흡의 수익 작물",
    },
    watermelon: {
      id: "watermelon",
      name: "수박",
      seedCost: 200,
      sellPrice: 600,
      growMs: 10 * 60 * 1000,
      className: "watermelon",
      tier: 3,
      unlockCodex: 6,
      note: "도감 6칸 달성 후 판매",
    },
  };

  const QUALITY_DEFS = {
    normal: { id: "normal", name: "일반", multiplier: 1, className: "quality-normal" },
    silver: { id: "silver", name: "은빛", multiplier: 1.55, className: "quality-silver" },
    gold: { id: "gold", name: "황금", multiplier: 2.8, className: "quality-gold" },
    wilted: { id: "wilted", name: "시든", multiplier: 0.6, className: "quality-wilted" },
  };

  const FORAGE_DEFS = {
    mushroom: { id: "mushroom", name: "작은 버섯", sellPrice: 18, symbol: "버", weight: 32 },
    berry: { id: "berry", name: "숲 열매", sellPrice: 22, symbol: "열", weight: 28 },
    wildflower: { id: "wildflower", name: "들꽃", sellPrice: 16, symbol: "꽃", weight: 28 },
    clover: { id: "clover", name: "네잎클로버", sellPrice: 45, symbol: "클", weight: 8 },
    firefly: { id: "firefly", name: "밤빛 조각", sellPrice: 64, symbol: "밤", weight: 4, nightOnly: true },
  };

  const PLOT_UNLOCK_COSTS = [0, 0, 0, 0, 120, 170, 240, 330, 460];
  const VISITORS = ["루나", "솔", "마루", "노아", "아라"];
  const FORAGE_POSITIONS = [
    { x: 19, y: 22 },
    { x: 42, y: 18 },
    { x: 66, y: 26 },
    { x: 27, y: 54 },
    { x: 54, y: 58 },
    { x: 75, y: 51 },
  ];
  const CODEX_REWARDS = [
    { id: "3", required: 3, title: "새싹 연구 보상", description: "방울토마토 씨앗 2개와 딸기 씨앗 1개" },
    { id: "6", required: 6, title: "정원 기록 보상", description: "골드 140과 황금 물뿌리개 1회" },
    { id: "10", required: 10, title: "수집가 보상", description: "수박 씨앗 1개와 골드 220" },
  ];

  return {
    SAVE_KEY,
    OFFLINE_GROWTH_CAP_MS,
    WILT_AFTER_MS,
    GATHER_REFILL_MS,
    CROP_DEFS,
    QUALITY_DEFS,
    FORAGE_DEFS,
    PLOT_UNLOCK_COSTS,
    VISITORS,
    FORAGE_POSITIONS,
    CODEX_REWARDS,
  };
});
