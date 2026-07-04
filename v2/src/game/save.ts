import { BALANCE_ID, CURRENT_SAVE_VERSION, DAILY_BAIT_MAX, VISITORS } from "./data";
import type { GameState } from "./types";

type SavedShape = Record<string, unknown>;
type Migration = (saved: SavedShape) => SavedShape;

const migrations: Record<number, Migration> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
};

export function migrate(saved: Partial<GameState> | null): Partial<GameState> | null {
  if (!saved) return null;

  let next: SavedShape = { ...(saved as SavedShape) };
  let version = typeof next.version === "number" ? next.version : 1;

  while (version < CURRENT_SAVE_VERSION) {
    const migration = migrations[version];
    if (!migration) break;
    next = migration(next);
    version = typeof next.version === "number" ? next.version : version + 1;
  }

  return next as Partial<GameState>;
}

function migrateV1ToV2(saved: SavedShape): SavedShape {
  const rawPlots = saved.plots;
  const plots = Array.isArray(rawPlots)
    ? rawPlots.map((plot) => {
        if (!plot || typeof plot !== "object") return plot;
        const typedPlot = plot as Record<string, unknown>;
        const crop = typedPlot.crop;
        if (!crop || typeof crop !== "object") return typedPlot;

        return {
          ...typedPlot,
          crop: {
            ...(crop as Record<string, unknown>),
            fertilized: Boolean((crop as Record<string, unknown>).fertilized),
          },
        };
      })
    : saved.plots;

  return {
    ...saved,
    version: 2,
    balanceId: typeof saved.balanceId === "string" ? saved.balanceId : BALANCE_ID,
    fertilizer: typeof saved.fertilizer === "number" ? saved.fertilizer : 0,
    plots,
  };
}

function migrateV2ToV3(saved: SavedShape): SavedShape {
  return {
    ...saved,
    version: 3,
    lastRainWateredDate: typeof saved.lastRainWateredDate === "string" ? saved.lastRainWateredDate : null,
    decorations: Array.isArray(saved.decorations) ? saved.decorations : [],
    compost:
      saved.compost && typeof saved.compost === "object"
        ? saved.compost
        : {
            slots: [null, null],
          },
  };
}

function migrateV3ToV4(saved: SavedShape): SavedShape {
  return {
    ...saved,
    version: 4,
    visitorAffinity:
      saved.visitorAffinity && typeof saved.visitorAffinity === "object"
        ? saved.visitorAffinity
        : Object.fromEntries(VISITORS.map((name) => [name, 0])),
    pets: Array.isArray(saved.pets) ? saved.pets : [],
    petAssistDates: saved.petAssistDates && typeof saved.petAssistDates === "object" ? saved.petAssistDates : {},
    bait: typeof saved.bait === "number" ? saved.bait : DAILY_BAIT_MAX,
    lastBaitRefillDate: typeof saved.lastBaitRefillDate === "string" ? saved.lastBaitRefillDate : null,
  };
}
