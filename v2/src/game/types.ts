export type QualityId = "normal" | "silver" | "gold" | "wilted";
export type SceneId = "garden" | "forest";
export type GrowthStage = "sprout" | "middle" | "ready";
export type BalanceId = "demo" | "live";
export type PortalId = "garden-to-forest" | "forest-to-garden";
export type SeasonId = "spring" | "summer" | "autumn" | "winter";
export type WeatherId = "clear" | "rain" | "snow";
export type DecorationType = "fence" | "flower_pot" | "bench" | "lamp" | "mini_pond";
export type CritterType = "butterfly" | "sparrow" | "rabbit" | "frog" | "hedgehog" | "owl";
export type InteractionActionKind =
  | "unlock"
  | "plant"
  | "water"
  | "wait"
  | "harvest"
  | "collect"
  | "portal"
  | "pickup"
  | "observe"
  | "compost";
export type PlayerSpawnId = "garden-default" | "garden-from-forest" | "forest-from-garden";

export type InteractionTarget =
  | { kind: "plot"; index: number }
  | { kind: "forage"; index: number }
  | { kind: "portal"; id: PortalId; to: SceneId }
  | { kind: "decoration"; id: string }
  | { kind: "compost" }
  | { kind: "critter"; id: string; type: CritterType; x: number; z: number };

export interface InteractionPrompt {
  target: InteractionTarget;
  targetKey: string;
  action: InteractionActionKind;
  label: string;
}

export interface CropDef {
  id: string;
  name: string;
  seedCost: number;
  sellPrice: number;
  growMs: number;
  className: string;
  tier: number;
  unlockCodex?: number;
  note: string;
}

export interface QualityDef {
  id: QualityId;
  name: string;
  multiplier: number;
  className: string;
}

export interface ForageDef {
  id: string;
  name: string;
  sellPrice: number;
  symbol: string;
  weight: number;
  nightOnly?: boolean;
  season?: SeasonId;
}

export interface DecorationDef {
  id: DecorationType;
  name: string;
  cost: number;
  cozy: number;
  colliderRadius: number;
}

export interface PlacedDecoration {
  id: string;
  type: DecorationType;
  x: number | null;
  z: number | null;
  rotY: number;
}

export interface CritterDef {
  id: CritterType;
  name: string;
  note: string;
}

export interface CodexReward {
  id: string;
  required: number;
  title: string;
  description: string;
}

export interface CropState {
  type: string;
  plantedAt: number;
  boostMs: number;
  watered: boolean;
  fertilized: boolean;
}

export interface PlotState {
  id: number;
  unlocked: boolean;
  crop: CropState | null;
}

export interface GatherSpot {
  id: string;
  item: string;
  collected: boolean;
}

export interface GatherState {
  lastRefillAt: number;
  charges: number;
  spots: GatherSpot[];
}

export interface CompostSlot {
  itemKey: string;
  startedAt: number;
}

export interface CompostState {
  slots: Array<CompostSlot | null>;
}

export interface DailyVisitor {
  date: string;
  name: string;
  cropType: string;
  bonus: number;
  done: boolean;
}

export interface GameState {
  version: number;
  balanceId: BalanceId;
  gold: number;
  selectedSeed: string;
  selectedPlot: number | null;
  scene: SceneId;
  seeds: Record<string, number>;
  plots: PlotState[];
  inventory: Record<string, number>;
  codex: Record<string, { firstObtainedAt: number }>;
  claimedRewards: string[];
  streak: number;
  lastLoginDate: string | null;
  goldenWater: number;
  fertilizer: number;
  gather: GatherState;
  dailyVisitor: DailyVisitor | null;
  lastRainWateredDate: string | null;
  decorations: PlacedDecoration[];
  compost: CompostState;
  createdAt: number;
  lastSeenAt: number;
}

export interface CropStatus {
  def: CropDef;
  elapsed: number;
  progress: number;
  remaining: number;
  matureAt: number;
  wilted: boolean;
  stage: GrowthStage;
  isReady: boolean;
}

export interface ItemInfo {
  kind: string;
  id: string;
  quality: string;
  name: string;
  sellPrice: number;
  qualityClass: string;
}

export interface CodexEntry {
  key: string;
  label: string;
}

export interface WelcomeSummary {
  offlineMs: number;
  readyCrops: number;
  wiltedCrops: number;
  gatherRefilled: boolean;
  dailyReward: boolean;
  weatherNotice: string;
  critterTrace: string | null;
  compostReadyCount: number;
}

export interface HarvestEffect {
  id: number;
  plotIndex: number;
  cropType: string;
  quality: QualityId;
  label: string;
}

export interface CareEffect {
  id: number;
  plotIndex: number;
  kind: "water" | "fertilizer";
}

export interface ActiveCritter {
  id: string;
  type: CritterType;
  spawnedAt: number;
  leaveAt: number;
  seed: number;
  x: number;
  z: number;
  heartPulse: number;
}
