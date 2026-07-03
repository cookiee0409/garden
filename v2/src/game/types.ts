export type QualityId = "normal" | "silver" | "gold" | "wilted";
export type SceneId = "garden" | "forest";
export type GrowthStage = "sprout" | "middle" | "ready";
export type BalanceId = "demo" | "live";
export type PortalId = "garden-to-forest" | "forest-to-garden";
export type InteractionActionKind = "unlock" | "plant" | "water" | "wait" | "harvest" | "collect" | "portal";
export type PlayerSpawnId = "garden-default" | "garden-from-forest" | "forest-from-garden";

export type InteractionTarget =
  | { kind: "plot"; index: number }
  | { kind: "forage"; index: number }
  | { kind: "portal"; id: PortalId; to: SceneId };

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
