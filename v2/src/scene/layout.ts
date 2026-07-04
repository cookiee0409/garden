import { FORAGE_POSITIONS } from "../game/data";
import type { InteractionTarget, PlayerSpawnId, SceneId } from "../game/types";

export const PLOT_COUNT = 9;
export const PLOT_SPACING = 1.85;
export const PLOT_SIZE = 1.1;
export const PLOT_HALF_SIZE = PLOT_SIZE / 2;

export const PLAYER_SPEED = 2.2;
export const PLAYER_RADIUS = 0.24;
export const ISLAND_RADIUS = 4.3;
export const INTERACTION_RADIUS = 0.9;

export const CAMERA_OFFSET: [number, number, number] = [6.6, 7.9, 6.6];
export const INITIAL_CAMERA_POSITION: [number, number, number] = [...CAMERA_OFFSET];

export const GARDEN_ISLAND_GEOMETRY = {
  top: [4.45, 4.85, 0.5, 8] as [number, number, number, number],
  bottom: [4.85, 4.1, 0.4, 8] as [number, number, number, number],
};

export const FOREST_ISLAND_GEOMETRY = {
  top: [4.55, 5.0, 0.48, 9] as [number, number, number, number],
  bottom: [5.0, 4.2, 0.4, 9] as [number, number, number, number],
};

export const POND_ISLAND_GEOMETRY = {
  top: [4.35, 4.7, 0.46, 10] as [number, number, number, number],
  bottom: [4.8, 4.05, 0.38, 10] as [number, number, number, number],
};

export const SPAWN_POSITIONS: Record<PlayerSpawnId, [number, number, number]> = {
  "garden-default": [0, 0.05, 2.9],
  "garden-from-forest": [0, 0.05, 2.9],
  "forest-from-garden": [0, 0.05, -2.9],
  "forest-from-pond": [0, 0.05, 2.9],
  "pond-from-forest": [0, 0.05, -2.9],
};

export const PORTALS: Record<SceneId, { target: InteractionTarget; position: [number, number, number]; sign: string }> = {
  garden: {
    target: { kind: "portal", id: "garden-to-forest", to: "forest" },
    position: [0, 0, 3.9],
    sign: "숲",
  },
  forest: {
    target: { kind: "portal", id: "forest-to-garden", to: "garden" },
    position: [0, 0, -3.9],
    sign: "정원",
  },
  pond: {
    target: { kind: "portal", id: "pond-to-forest", to: "forest" },
    position: [0, 0, -3.9],
    sign: "숲",
  },
};

export const FOREST_POND_PORTAL = {
  target: { kind: "portal", id: "forest-to-pond", to: "pond" } as InteractionTarget,
  position: [0, 0, 3.9] as [number, number, number],
  sign: "연못",
};

export const GARDEN_TREES = [
  { position: [-4.18, 0, -0.55] as [number, number, number], scale: 0.82, collider: { x: -4.18, z: -0.55, radius: 0.28 } },
  { position: [4.18, 0, 0.55] as [number, number, number], scale: 0.76, collider: { x: 4.18, z: 0.55, radius: 0.28 } },
];

export const FOREST_TREES = [
  { position: [-4.18, 0, -0.4] as [number, number, number], scale: 1.12, collider: { x: -4.18, z: -0.4, radius: 0.3 } },
  { position: [4.18, 0, 0.4] as [number, number, number], scale: 0.95, collider: { x: 4.18, z: 0.4, radius: 0.28 } },
  { position: [-0.9, 0, 4.2] as [number, number, number], scale: 0.82, collider: { x: -0.9, z: 4.2, radius: 0.25 } },
  { position: [1.35, 0, -4.0] as [number, number, number], scale: 1.02, collider: { x: 1.35, z: -4.0, radius: 0.29 } },
];

export const GARDEN_TREE_COLLIDERS = GARDEN_TREES.map((tree) => tree.collider);
export const FOREST_TREE_COLLIDERS = FOREST_TREES.map((tree) => tree.collider);
export const COMPOST_POSITION = [1.2, 0, 3.7] as [number, number, number];
export const COMPOST_COLLIDER = { x: COMPOST_POSITION[0], z: COMPOST_POSITION[2], radius: 0.36 };
export const FISHING_SPOT_POSITION = [0, 0, 1.35] as [number, number, number];

export function plotPosition(index: number): [number, number] {
  const row = Math.floor(index / 3);
  const col = index % 3;
  return [(col - 1) * PLOT_SPACING, (row - 1) * PLOT_SPACING];
}

export function forestPosition(index: number): [number, number] {
  const position = FORAGE_POSITIONS[index % FORAGE_POSITIONS.length];
  return [(position.x / 100 - 0.5) * 6.6, (position.y / 100 - 0.5) * 5.6];
}
