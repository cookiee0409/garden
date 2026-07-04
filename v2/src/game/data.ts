import type { BalanceId, CodexReward, CritterDef, CropDef, DecorationDef, FishDef, ForageDef, PetDef, QualityDef, QualityId } from "./types";

export const SAVE_KEY = "mini-idle-garden-save-v1";
export const BALANCE_STORAGE_KEY = "mini-idle-garden-balance";
export const CURRENT_SAVE_VERSION = 4;
export const DAILY_BAIT_MAX = 5;

export const BALANCE_PRESETS: Record<
  BalanceId,
  {
    id: BalanceId;
    label: string;
    cropGrowMs: Record<string, number>;
    gatherRefillMs: number;
    wiltAfterMs: number;
    compostMs: number;
    critterCheckMinMs: number;
    critterCheckMaxMs: number;
    critterStayMinMs: number;
    critterStayMaxMs: number;
    critterTraceOfflineMs: number;
    fishingWaitMinMs: number;
    fishingWaitMaxMs: number;
    fishingBiteWindowMs: number;
  }
> = {
  demo: {
    id: "demo",
    label: "데모 밸런스",
    cropGrowMs: {
      tomato: 45 * 1000,
      carrot: 75 * 1000,
      strawberry: 4 * 60 * 1000,
      sunflower: 6 * 60 * 1000,
      watermelon: 10 * 60 * 1000,
      moon_mushroom: 20 * 60 * 1000,
      rainbow_flower: 20 * 60 * 1000,
    },
    gatherRefillMs: 5 * 60 * 1000,
    wiltAfterMs: 45 * 60 * 1000,
    compostMs: 3 * 60 * 1000,
    critterCheckMinMs: 90 * 1000,
    critterCheckMaxMs: 180 * 1000,
    critterStayMinMs: 30 * 1000,
    critterStayMaxMs: 60 * 1000,
    critterTraceOfflineMs: 10 * 60 * 1000,
    fishingWaitMinMs: 3 * 1000,
    fishingWaitMaxMs: 10 * 1000,
    fishingBiteWindowMs: 1200,
  },
  live: {
    id: "live",
    label: "실서비스 밸런스",
    cropGrowMs: {
      tomato: 4 * 60 * 60 * 1000,
      carrot: 5 * 60 * 60 * 1000,
      strawberry: 8 * 60 * 60 * 1000,
      sunflower: 10 * 60 * 60 * 1000,
      watermelon: 12 * 60 * 60 * 1000,
      moon_mushroom: 24 * 60 * 60 * 1000,
      rainbow_flower: 30 * 60 * 60 * 1000,
    },
    gatherRefillMs: 6 * 60 * 60 * 1000,
    wiltAfterMs: 24 * 60 * 60 * 1000,
    compostMs: 6 * 60 * 60 * 1000,
    critterCheckMinMs: 15 * 60 * 1000,
    critterCheckMaxMs: 30 * 60 * 1000,
    critterStayMinMs: 3 * 60 * 1000,
    critterStayMaxMs: 8 * 60 * 1000,
    critterTraceOfflineMs: 6 * 60 * 60 * 1000,
    fishingWaitMinMs: 3 * 1000,
    fishingWaitMaxMs: 10 * 1000,
    fishingBiteWindowMs: 1200,
  },
};

export const BALANCE_ID = resolveBalanceId();
export const BALANCE_LABEL = BALANCE_PRESETS[BALANCE_ID].label;
export const OFFLINE_GROWTH_CAP_MS = 12 * 60 * 60 * 1000;
export const WILT_AFTER_MS = BALANCE_PRESETS[BALANCE_ID].wiltAfterMs;
export const GATHER_REFILL_MS = BALANCE_PRESETS[BALANCE_ID].gatherRefillMs;
export const COMPOST_MS = BALANCE_PRESETS[BALANCE_ID].compostMs;

export const CROP_DEFS: Record<string, CropDef> = {
  tomato: {
    id: "tomato",
    name: "방울토마토",
    seedCost: 10,
    sellPrice: 25,
    growMs: BALANCE_PRESETS[BALANCE_ID].cropGrowMs.tomato,
    className: "tomato",
    tier: 1,
    note: "가볍게 돌리는 첫 작물",
  },
  carrot: {
    id: "carrot",
    name: "당근",
    seedCost: 14,
    sellPrice: 34,
    growMs: BALANCE_PRESETS[BALANCE_ID].cropGrowMs.carrot,
    className: "carrot",
    tier: 1,
    note: "초반 골드 벌이용",
  },
  strawberry: {
    id: "strawberry",
    name: "딸기",
    seedCost: 50,
    sellPrice: 140,
    growMs: BALANCE_PRESETS[BALANCE_ID].cropGrowMs.strawberry,
    className: "strawberry",
    tier: 2,
    note: "하루 두 번 접속 리듬의 중심",
  },
  sunflower: {
    id: "sunflower",
    name: "해바라기",
    seedCost: 70,
    sellPrice: 190,
    growMs: BALANCE_PRESETS[BALANCE_ID].cropGrowMs.sunflower,
    className: "sunflower",
    tier: 2,
    note: "조금 더 긴 호흡의 수익 작물",
  },
  watermelon: {
    id: "watermelon",
    name: "수박",
    seedCost: 200,
    sellPrice: 600,
    growMs: BALANCE_PRESETS[BALANCE_ID].cropGrowMs.watermelon,
    className: "watermelon",
    tier: 3,
    unlockCodex: 6,
    note: "도감 6칸 달성 후 판매",
  },
  moon_mushroom: {
    id: "moon_mushroom",
    name: "달빛버섯",
    seedCost: 520,
    sellPrice: 1700,
    growMs: BALANCE_PRESETS[BALANCE_ID].cropGrowMs.moon_mushroom,
    className: "moon-mushroom",
    tier: 4,
    unlockCodex: 14,
    note: "긴 호흡으로 키우는 밤빛 작물",
  },
  rainbow_flower: {
    id: "rainbow_flower",
    name: "무지개꽃",
    seedCost: 640,
    sellPrice: 2100,
    growMs: BALANCE_PRESETS[BALANCE_ID].cropGrowMs.rainbow_flower,
    className: "rainbow-flower",
    tier: 4,
    unlockCodex: 14,
    note: "도감 후반을 여는 장기 목표",
  },
};

export const QUALITY_DEFS: Record<QualityId, QualityDef> = {
  normal: { id: "normal", name: "일반", multiplier: 1, className: "quality-normal" },
  silver: { id: "silver", name: "은빛", multiplier: 1.55, className: "quality-silver" },
  gold: { id: "gold", name: "황금", multiplier: 2.8, className: "quality-gold" },
  wilted: { id: "wilted", name: "시든", multiplier: 0.6, className: "quality-wilted" },
};

export const FORAGE_DEFS: Record<string, ForageDef> = {
  mushroom: { id: "mushroom", name: "작은 버섯", sellPrice: 18, symbol: "버", weight: 32 },
  berry: { id: "berry", name: "숲 열매", sellPrice: 22, symbol: "열", weight: 28 },
  wildflower: { id: "wildflower", name: "들꽃", sellPrice: 16, symbol: "꽃", weight: 28 },
  clover: { id: "clover", name: "네잎클로버", sellPrice: 45, symbol: "클", weight: 8 },
  firefly: { id: "firefly", name: "밤빛 조각", sellPrice: 64, symbol: "밤", weight: 4, nightOnly: true },
  cherry_petal: { id: "cherry_petal", name: "벚꽃잎", sellPrice: 58, symbol: "봄", weight: 4, season: "spring" },
  cicada_shell: { id: "cicada_shell", name: "매미 허물", sellPrice: 60, symbol: "여", weight: 4, season: "summer" },
  acorn: { id: "acorn", name: "도토리", sellPrice: 62, symbol: "가", weight: 4, season: "autumn" },
  snow_crystal: { id: "snow_crystal", name: "눈꽃 조각", sellPrice: 66, symbol: "겨", weight: 4, season: "winter" },
};

export const DECOR_DEFS: Record<string, DecorationDef> = {
  fence: { id: "fence", name: "울타리", cost: 60, cozy: 2, colliderRadius: 0.28 },
  flower_pot: { id: "flower_pot", name: "화분", cost: 90, cozy: 3, colliderRadius: 0.24 },
  bench: { id: "bench", name: "벤치", cost: 160, cozy: 5, colliderRadius: 0.38 },
  lamp: { id: "lamp", name: "가로등", cost: 220, cozy: 6, colliderRadius: 0.26 },
  mini_pond: { id: "mini_pond", name: "미니 연못", cost: 320, cozy: 8, colliderRadius: 0.48 },
  pet_house: { id: "pet_house", name: "펫 하우스", cost: 280, cozy: 6, colliderRadius: 0.38 },
};

export const CRITTER_DEFS: Record<string, CritterDef> = {
  butterfly: { id: "butterfly", name: "나비", note: "낮에 꽃 작물이 있으면 찾아옵니다." },
  sparrow: { id: "sparrow", name: "참새", note: "낮에 물 준 밭이 많으면 내려앉습니다." },
  rabbit: { id: "rabbit", name: "토끼", note: "낮에 당근 냄새를 맡고 옵니다." },
  frog: { id: "frog", name: "개구리", note: "비나 눈이 오는 날 폴짝입니다." },
  hedgehog: { id: "hedgehog", name: "고슴도치", note: "밤의 아늑한 정원을 좋아합니다." },
  owl: { id: "owl", name: "부엉이", note: "밤이면 나무 곁에서 조용히 지켜봅니다." },
};

export const PET_DEFS: Record<string, PetDef> = {
  luna_cat: { id: "luna_cat", visitor: "루나", name: "루나의 고양이", model: "hedgehog", helper: "water" },
  sol_pup: { id: "sol_pup", visitor: "솔", name: "솔의 강아지", model: "rabbit", helper: "forage" },
  maru_sparrow: { id: "maru_sparrow", visitor: "마루", name: "마루의 참새", model: "sparrow", helper: "forage" },
  noa_turtle: { id: "noa_turtle", visitor: "노아", name: "노아의 거북이", model: "frog", helper: "water" },
  ara_fox: { id: "ara_fox", visitor: "아라", name: "아라의 여우", model: "owl", helper: "water" },
};

export const FISH_DEFS: Record<string, FishDef> = {
  pond_minow: { id: "pond_minow", name: "연못 피라미", sellPrice: 70, weight: 32, dayOnly: true },
  sun_carp: { id: "sun_carp", name: "햇살 잉어", sellPrice: 96, weight: 24, dayOnly: true },
  rain_catfish: { id: "rain_catfish", name: "빗수염 메기", sellPrice: 130, weight: 12, rainBonus: 24 },
  moon_eel: { id: "moon_eel", name: "달그림자 장어", sellPrice: 142, weight: 12, nightOnly: true },
  lotus_koi: { id: "lotus_koi", name: "연꽃 비단잉어", sellPrice: 165, weight: 8, season: "spring" },
  gold_scale: { id: "gold_scale", name: "금비늘 물고기", sellPrice: 210, weight: 4 },
};

export const PLOT_UNLOCK_COSTS = [0, 0, 0, 0, 120, 170, 240, 330, 460];
export const VISITORS = ["루나", "솔", "마루", "노아", "아라"];
export const FORAGE_POSITIONS = [
  { x: 19, y: 22 },
  { x: 42, y: 18 },
  { x: 66, y: 26 },
  { x: 27, y: 54 },
  { x: 54, y: 58 },
  { x: 75, y: 51 },
];
export const FERTILIZER_RECIPE = {
  mushroom: 2,
  wildflower: 1,
} as const;
export const CODEX_REWARDS: CodexReward[] = [
  { id: "3", required: 3, title: "새싹 연구 보상", description: "방울토마토 씨앗 2개와 딸기 씨앗 1개" },
  { id: "6", required: 6, title: "정원 기록 보상", description: "골드 140과 황금 물뿌리개 1회" },
  { id: "10", required: 10, title: "수집가 보상", description: "수박·달빛버섯·무지개꽃 씨앗 1개와 골드 220" },
  { id: "20", required: 20, title: "정원의 친구 보상", description: "골드 500과 황금 물뿌리개 1회" },
];

function resolveBalanceId(): BalanceId {
  if (typeof window === "undefined") return "demo";

  const urlBalance = new URLSearchParams(window.location.search).get("balance");
  if (urlBalance === "demo" || urlBalance === "live") {
    window.localStorage.setItem(BALANCE_STORAGE_KEY, urlBalance);
    return urlBalance;
  }

  const stored = window.localStorage.getItem(BALANCE_STORAGE_KEY);
  return stored === "live" ? "live" : "demo";
}
