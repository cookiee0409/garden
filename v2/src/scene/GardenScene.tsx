import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Object3D, Vector3 } from "three";
import type { Group, InstancedMesh, Mesh, MeshBasicMaterial } from "three";
import { DECOR_DEFS, FORAGE_DEFS, PLOT_UNLOCK_COSTS } from "../game/data";
import { getInteractionPrompt } from "../game/interactions";
import {
  formatDuration,
  getCompostRemainingMs,
  getCropStatus,
  getGatherRemainingMs,
  getSeason,
  getWeather,
  isDecorationPlaced,
  isNightTime,
} from "../game/logic";
import { useGameStore } from "../game/store";
import type {
  ActiveCritter,
  CareEffect,
  DecorationType,
  GameState,
  HarvestEffect as HarvestEffectType,
  InteractionPrompt,
  InteractionTarget,
  PlacedDecoration,
  SceneId,
  SeasonId,
  WeatherId,
} from "../game/types";
import { virtualInteraction, virtualMove } from "../input/playerInput";
import { CritterModel } from "./CritterModel";
import { CropModel } from "./CropModel";
import {
  CAMERA_OFFSET,
  COMPOST_COLLIDER,
  COMPOST_POSITION,
  FOREST_ISLAND_GEOMETRY,
  FOREST_TREES,
  FOREST_TREE_COLLIDERS,
  GARDEN_ISLAND_GEOMETRY,
  GARDEN_TREES,
  GARDEN_TREE_COLLIDERS,
  INITIAL_CAMERA_POSITION,
  INTERACTION_RADIUS,
  ISLAND_RADIUS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PLOT_COUNT,
  PLOT_HALF_SIZE,
  PORTALS,
  SPAWN_POSITIONS,
  forestPosition,
  plotPosition,
} from "./layout";
import type { ScenePalette } from "./palette";
import { getScenePalette } from "./palette";
import { PlayerModel } from "./PlayerModel";

const GARDEN_INTERACTION_TARGETS: InteractionTarget[] = [
  ...Array.from({ length: PLOT_COUNT }, (_, index) => ({ kind: "plot", index }) as InteractionTarget),
  { kind: "compost" },
  PORTALS.garden.target,
];

const critterPositions = new Map<string, Vector3>();

const PLOT_COLLIDERS = Array.from({ length: PLOT_COUNT }, (_, index) => {
  const [x, z] = plotPosition(index);
  return { x, z };
});

function buildForestInteractionTargets(spots: GameState["gather"]["spots"]): InteractionTarget[] {
  const targets: InteractionTarget[] = [];
  spots.forEach((spot, index) => {
    if (!spot.collected) targets.push({ kind: "forage", index });
  });
  targets.push(PORTALS.forest.target);
  return targets;
}

function buildGardenInteractionTargets(game: GameState, activeCritters: ActiveCritter[]): InteractionTarget[] {
  const targets: InteractionTarget[] = [...GARDEN_INTERACTION_TARGETS];
  game.decorations.forEach((decoration) => {
    if (isDecorationPlaced(decoration)) targets.push({ kind: "decoration", id: decoration.id });
  });
  activeCritters.forEach((critter) => {
    const position = critterPositions.get(critter.id);
    targets.push({
      kind: "critter",
      id: critter.id,
      type: critter.type,
      x: position?.x ?? critter.x,
      z: position?.z ?? critter.z,
    });
  });
  return targets;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function angleLerp(from: number, to: number, amount: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * amount;
}

function clampToIsland(position: Vector3) {
  const max = ISLAND_RADIUS - PLAYER_RADIUS;
  const distance = Math.hypot(position.x, position.z);
  if (distance <= max || distance === 0) return;
  const scale = max / distance;
  position.x *= scale;
  position.z *= scale;
}

function resolveAabbCollision(position: Vector3, centerX: number, centerZ: number, halfX: number, halfZ: number) {
  const dx = position.x - centerX;
  const dz = position.z - centerZ;
  const overlapX = halfX + PLAYER_RADIUS - Math.abs(dx);
  const overlapZ = halfZ + PLAYER_RADIUS - Math.abs(dz);
  if (overlapX <= 0 || overlapZ <= 0) return;

  if (overlapX < overlapZ) {
    position.x += dx >= 0 ? overlapX : -overlapX;
  } else {
    position.z += dz >= 0 ? overlapZ : -overlapZ;
  }
}

function resolveCircleCollision(position: Vector3, centerX: number, centerZ: number, radius: number) {
  const dx = position.x - centerX;
  const dz = position.z - centerZ;
  const distance = Math.hypot(dx, dz);
  const minDistance = radius + PLAYER_RADIUS;
  if (distance >= minDistance) return;

  if (distance === 0) {
    position.x += minDistance;
    return;
  }
  const push = (minDistance - distance) / distance;
  position.x += dx * push;
  position.z += dz * push;
}

function resolveDecorationCollisions(position: Vector3, decorations: PlacedDecoration[]) {
  for (const decoration of decorations) {
    if (!isDecorationPlaced(decoration)) continue;
    const def = DECOR_DEFS[decoration.type];
    if (!def) continue;
    resolveCircleCollision(position, decoration.x, decoration.z, def.colliderRadius);
  }
}

function resolveCollisions(position: Vector3, scene: SceneId, game: GameState) {
  clampToIsland(position);

  if (scene === "garden") {
    for (const plot of PLOT_COLLIDERS) {
      resolveAabbCollision(position, plot.x, plot.z, PLOT_HALF_SIZE, PLOT_HALF_SIZE);
    }
    for (const tree of GARDEN_TREE_COLLIDERS) {
      resolveCircleCollision(position, tree.x, tree.z, tree.radius);
    }
    resolveCircleCollision(position, COMPOST_COLLIDER.x, COMPOST_COLLIDER.z, COMPOST_COLLIDER.radius);
    resolveDecorationCollisions(position, game.decorations);
  } else {
    for (const tree of FOREST_TREE_COLLIDERS) {
      resolveCircleCollision(position, tree.x, tree.z, tree.radius);
    }
  }

  clampToIsland(position);
}

function circleOverlapsAabb(x: number, z: number, radius: number, centerX: number, centerZ: number, halfX: number, halfZ: number): boolean {
  const closestX = Math.max(centerX - halfX, Math.min(x, centerX + halfX));
  const closestZ = Math.max(centerZ - halfZ, Math.min(z, centerZ + halfZ));
  return Math.hypot(x - closestX, z - closestZ) < radius;
}

function circlesOverlap(x: number, z: number, radius: number, otherX: number, otherZ: number, otherRadius: number): boolean {
  return Math.hypot(x - otherX, z - otherZ) < radius + otherRadius;
}

function canPlaceDecoration(game: GameState, type: DecorationType, x: number, z: number, ignoreId?: string): boolean {
  const def = DECOR_DEFS[type];
  if (!def) return false;
  const radius = def.colliderRadius;
  if (Math.hypot(x, z) > ISLAND_RADIUS - radius - 0.08) return false;

  for (const plot of PLOT_COLLIDERS) {
    if (circleOverlapsAabb(x, z, radius + 0.08, plot.x, plot.z, PLOT_HALF_SIZE, PLOT_HALF_SIZE)) return false;
  }
  for (const tree of GARDEN_TREE_COLLIDERS) {
    if (circlesOverlap(x, z, radius, tree.x, tree.z, tree.radius + 0.08)) return false;
  }
  if (circlesOverlap(x, z, radius, COMPOST_COLLIDER.x, COMPOST_COLLIDER.z, COMPOST_COLLIDER.radius + 0.12)) return false;
  const portal = PORTALS.garden.position;
  if (circlesOverlap(x, z, radius, portal[0], portal[2], 0.72)) return false;

  for (const decoration of game.decorations) {
    if (decoration.id === ignoreId || !isDecorationPlaced(decoration)) continue;
    const other = DECOR_DEFS[decoration.type];
    if (other && circlesOverlap(x, z, radius, decoration.x, decoration.z, other.colliderRadius + 0.08)) return false;
  }

  return true;
}

function targetPosition(target: InteractionTarget, game: GameState): [number, number] {
  if (target.kind === "plot") return plotPosition(target.index);
  if (target.kind === "forage") return forestPosition(target.index);
  if (target.kind === "compost") return [COMPOST_POSITION[0], COMPOST_POSITION[2]];
  if (target.kind === "critter") return [target.x, target.z];
  if (target.kind === "decoration") {
    const decoration = game.decorations.find((item) => item.id === target.id);
    if (decoration && isDecorationPlaced(decoration)) return [decoration.x, decoration.z];
    return [0, 0];
  }
  const portal = target.id === "garden-to-forest" ? PORTALS.garden : PORTALS.forest;
  return [portal.position[0], portal.position[2]];
}

function nearestInteraction(game: GameState, targets: InteractionTarget[], position: Vector3, now: number): InteractionPrompt | null {
  let nearestTarget: InteractionTarget | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const [x, z] = targetPosition(target, game);
    const distance = Math.hypot(position.x - x, position.z - z);
    if (distance > INTERACTION_RADIUS) continue;
    if (distance < nearestDistance) {
      nearestTarget = target;
      nearestDistance = distance;
    }
  }

  return nearestTarget ? getInteractionPrompt(game, nearestTarget, now) : null;
}

function PlayerController() {
  const scene = useGameStore((store) => store.game.scene);
  const game = useGameStore((store) => store.game);
  const activeCritters = useGameStore((store) => store.activeCritters);
  const placementDecorationId = useGameStore((store) => store.placementDecorationId);
  const now = useGameStore((store) => store.now);
  const spawn = useGameStore((store) => store.playerSpawn);
  const setNearbyInteraction = useGameStore((store) => store.setNearbyInteraction);
  const performNearbyInteraction = useGameStore((store) => store.performNearbyInteraction);
  const placeDecoration = useGameStore((store) => store.placeDecoration);
  const cancelDecorationPlacement = useGameStore((store) => store.cancelDecorationPlacement);
  const showToast = useGameStore((store) => store.showToast);

  const player = useRef<Group>(null);
  const placementPreview = useRef<Group>(null);
  const keys = useRef(new Set<string>());
  const gameRef = useRef(game);
  const nowRef = useRef(now);
  const sceneRef = useRef(scene);
  const activeCrittersRef = useRef(activeCritters);
  const placementDecorationIdRef = useRef(placementDecorationId);
  const placementValidRef = useRef(false);
  const placementPointRef = useRef({ x: 0, z: 0, rotY: 0 });
  const nearbyRef = useRef<InteractionPrompt | null>(null);
  const walkingRef = useRef(false);
  const cameraTarget = useRef(new Vector3(0, 0.4, 0));
  const cameraLookTarget = useRef(new Vector3());
  const cameraPositionTarget = useRef(new Vector3());
  const cameraOffset = useRef(new Vector3(...CAMERA_OFFSET));
  const nextPosition = useRef(new Vector3());
  const lastVirtualInteraction = useRef(virtualInteraction.requestId);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    nowRef.current = now;
  }, [now]);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    activeCrittersRef.current = activeCritters;
  }, [activeCritters]);

  useEffect(() => {
    placementDecorationIdRef.current = placementDecorationId;
  }, [placementDecorationId]);

  useEffect(() => {
    const position = SPAWN_POSITIONS[spawn.id];
    player.current?.position.set(...position);
    cameraTarget.current.set(position[0], 0.4, position[2]);
    setNearbyInteraction(null);
  }, [setNearbyInteraction, spawn.id, spawn.version]);

  const tryPlaceDecoration = () => {
    const id = placementDecorationIdRef.current;
    if (!id) return false;

    const decoration = gameRef.current.decorations.find((item) => item.id === id);
    if (!decoration) {
      cancelDecorationPlacement();
      return true;
    }

    if (!placementValidRef.current) {
      showToast("여기에는 설치할 수 없습니다.");
      return true;
    }

    const point = placementPointRef.current;
    placeDecoration(id, point.x, point.z, point.rotY);
    return true;
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) return;
      if (event.code === "Escape" && placementDecorationIdRef.current) {
        event.preventDefault();
        cancelDecorationPlacement();
        return;
      }
      if (event.code === "KeyE" || event.code === "Space") {
        event.preventDefault();
        if (tryPlaceDecoration()) return;
        const target = nearbyRef.current?.target;
        if (target && player.current) {
          const [x, z] = targetPosition(target, gameRef.current);
          player.current.rotation.y = angleLerp(player.current.rotation.y, Math.atan2(x - player.current.position.x, z - player.current.position.z), 0.65);
        }
        performNearbyInteraction();
        return;
      }
      keys.current.add(event.code);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [cancelDecorationPlacement, performNearbyInteraction, placeDecoration, showToast]);

  useFrame((state, delta) => {
    if (!player.current) return;

    let x = 0;
    let z = 0;
    if (keys.current.has("KeyA") || keys.current.has("ArrowLeft")) x -= 1;
    if (keys.current.has("KeyD") || keys.current.has("ArrowRight")) x += 1;
    if (keys.current.has("KeyW") || keys.current.has("ArrowUp")) z -= 1;
    if (keys.current.has("KeyS") || keys.current.has("ArrowDown")) z += 1;

    x += virtualMove.x;
    z += virtualMove.z;

    const length = Math.hypot(x, z);
    const moving = length > 0.08;
    walkingRef.current = moving;
    if (moving) {
      x /= length;
      z /= length;
      nextPosition.current.copy(player.current.position);
      nextPosition.current.x += x * PLAYER_SPEED * delta;
      nextPosition.current.z += z * PLAYER_SPEED * delta;
      resolveCollisions(nextPosition.current, sceneRef.current, gameRef.current);
      player.current.position.copy(nextPosition.current);
      player.current.rotation.y = angleLerp(player.current.rotation.y, Math.atan2(x, z), Math.min(1, delta * 12));
    }

    const placementId = placementDecorationIdRef.current;
    if (placementId && placementPreview.current) {
      const decoration = gameRef.current.decorations.find((item) => item.id === placementId);
      const rotY = player.current.rotation.y;
      const frontX = player.current.position.x + Math.sin(rotY) * 0.8;
      const frontZ = player.current.position.z + Math.cos(rotY) * 0.8;
      placementPointRef.current = { x: frontX, z: frontZ, rotY };
      placementValidRef.current = Boolean(decoration && canPlaceDecoration(gameRef.current, decoration.type, frontX, frontZ, decoration.id));
      placementPreview.current.position.set(frontX, 0.08, frontZ);
      placementPreview.current.rotation.y = rotY;
    }

    if (lastVirtualInteraction.current !== virtualInteraction.requestId) {
      lastVirtualInteraction.current = virtualInteraction.requestId;
      if (tryPlaceDecoration()) return;
      const target = nearbyRef.current?.target;
      if (target) {
        const [targetX, targetZ] = targetPosition(target, gameRef.current);
        player.current.rotation.y = angleLerp(player.current.rotation.y, Math.atan2(targetX - player.current.position.x, targetZ - player.current.position.z), 0.65);
      }
      performNearbyInteraction();
    }

    const targets =
      sceneRef.current === "garden"
        ? buildGardenInteractionTargets(gameRef.current, activeCrittersRef.current)
        : buildForestInteractionTargets(gameRef.current.gather.spots);
    const prompt = placementId ? null : nearestInteraction(gameRef.current, targets, player.current.position, nowRef.current);
    nearbyRef.current = prompt;
    setNearbyInteraction(prompt);

    cameraLookTarget.current.set(player.current.position.x, 0.42, player.current.position.z);
    cameraTarget.current.lerp(cameraLookTarget.current, 0.08);
    clampToIsland(cameraTarget.current);
    cameraPositionTarget.current.copy(cameraTarget.current).add(cameraOffset.current);
    state.camera.position.lerp(cameraPositionTarget.current, 0.08);
    state.camera.lookAt(cameraTarget.current);
  });

  const placementDecoration = placementDecorationId
    ? game.decorations.find((decoration) => decoration.id === placementDecorationId)
    : null;

  return (
    <>
      <group ref={player} position={SPAWN_POSITIONS[spawn.id]}>
        <PlayerModel walkingRef={walkingRef} />
      </group>
      {placementDecoration && (
        <group ref={placementPreview} position={[0, 0.08, 0]}>
          <DecorationPreview type={placementDecoration.type} validRef={placementValidRef} />
        </group>
      )}
    </>
  );
}

function DecorationModel({ type, preview = false }: { type: DecorationType; preview?: boolean }) {
  const opacity = preview ? 0.48 : 1;
  const transparent = preview;

  if (type === "fence") {
    return (
      <group>
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, 0.28, 0]}>
            <boxGeometry args={[0.07, 0.48, 0.08]} />
            <meshStandardMaterial color="#8d6546" transparent={transparent} opacity={opacity} />
          </mesh>
        ))}
        {[0.22, 0.38].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[0.58, 0.06, 0.08]} />
            <meshStandardMaterial color="#b98258" transparent={transparent} opacity={opacity} />
          </mesh>
        ))}
      </group>
    );
  }

  if (type === "flower_pot") {
    return (
      <group>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.16, 0.2, 0.25, 10]} />
          <meshStandardMaterial color="#bd6b4a" transparent={transparent} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.34, 0]}>
          <sphereGeometry args={[0.17, 12, 8]} />
          <meshStandardMaterial color="#77b86f" transparent={transparent} opacity={opacity} />
        </mesh>
        <mesh position={[0.04, 0.47, 0]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color="#f0a1bd" transparent={transparent} opacity={opacity} />
        </mesh>
      </group>
    );
  }

  if (type === "bench") {
    return (
      <group>
        <mesh position={[0, 0.26, 0]}>
          <boxGeometry args={[0.68, 0.09, 0.25]} />
          <meshStandardMaterial color="#9a6a46" transparent={transparent} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.42, 0.12]} rotation={[0.28, 0, 0]}>
          <boxGeometry args={[0.68, 0.08, 0.26]} />
          <meshStandardMaterial color="#b98258" transparent={transparent} opacity={opacity} />
        </mesh>
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, 0.12, 0]}>
            <boxGeometry args={[0.06, 0.24, 0.06]} />
            <meshStandardMaterial color="#6f513d" transparent={transparent} opacity={opacity} />
          </mesh>
        ))}
      </group>
    );
  }

  if (type === "lamp") {
    return (
      <group>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.035, 0.05, 0.82, 8]} />
          <meshStandardMaterial color="#5c5b57" transparent={transparent} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.92, 0]}>
          <sphereGeometry args={[0.14, 12, 8]} />
          <meshStandardMaterial color="#ffd86f" emissive="#f2bc46" emissiveIntensity={preview ? 0.15 : 0.35} transparent={transparent} opacity={opacity} />
        </mesh>
        <mesh position={[0, 1.08, 0]}>
          <coneGeometry args={[0.18, 0.18, 8]} />
          <meshStandardMaterial color="#4f5654" transparent={transparent} opacity={opacity} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0, 0.08, 0]} scale={[1, 0.18, 0.72]}>
        <sphereGeometry args={[0.42, 18, 10]} />
        <meshStandardMaterial color="#7fc8d8" transparent opacity={preview ? 0.42 : 0.78} />
      </mesh>
      <mesh position={[-0.16, 0.16, 0.03]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial color="#d8cfa4" transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh position={[0.17, 0.15, -0.05]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshStandardMaterial color="#a8c98b" transparent={transparent} opacity={opacity} />
      </mesh>
    </group>
  );
}

function DecorationPreview({ type, validRef }: { type: DecorationType; validRef: MutableRefObject<boolean> }) {
  const material = useRef<MeshBasicMaterial>(null);

  useFrame(() => {
    if (!material.current) return;
    material.current.color.set(validRef.current ? "#7be495" : "#ef6d79");
  });

  return (
    <group>
      <DecorationModel type={type} preview />
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.43, 0.52, 32]} />
        <meshBasicMaterial ref={material} color="#7be495" transparent opacity={0.78} />
      </mesh>
    </group>
  );
}

function ReadyMarker() {
  const mesh = useRef<Mesh>(null);
  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.rotation.y += 0.03;
    mesh.current.position.y = 1.05 + Math.sin(state.clock.elapsedTime * 2.4) * 0.07;
  });
  return (
    <mesh ref={mesh} position={[0, 1.05, 0]}>
      <octahedronGeometry args={[0.13]} />
      <meshStandardMaterial color="#f2bc46" emissive="#f2bc46" emissiveIntensity={0.45} />
    </mesh>
  );
}

function CareBurst({ effect }: { effect: CareEffect }) {
  const group = useRef<Group>(null);
  const startedAt = useRef<number | null>(null);
  useFrame((state) => {
    if (!group.current) return;
    if (startedAt.current === null) startedAt.current = state.clock.elapsedTime;
    const progress = Math.min(1, (state.clock.elapsedTime - startedAt.current) / 0.72);
    group.current.position.y = 0.45 + progress * 0.55;
    group.current.scale.setScalar(1 + progress * 0.3);
  });

  const color = effect.kind === "water" ? "#8bd5eb" : "#f2bc46";
  return (
    <group ref={group} position={[0, 0.45, 0]}>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 0.22, Math.sin(index) * 0.06, Math.sin(angle) * 0.22]}>
            <sphereGeometry args={[0.045, 8, 6]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={effect.kind === "fertilizer" ? 0.35 : 0.12} />
          </mesh>
        );
      })}
    </group>
  );
}

function PlotTile({ index }: { index: number }) {
  const plot = useGameStore((store) => store.game.plots[index]);
  const selected = useGameStore((store) => store.game.selectedPlot === index);
  const now = useGameStore((store) => store.now);
  const allCareEffects = useGameStore((store) => store.careEffects);
  const selectPlot = useGameStore((store) => store.selectPlot);
  const [x, z] = plotPosition(index);

  const status = plot.crop ? getCropStatus(plot, now) : null;
  const careEffects = allCareEffects.filter((effect) => effect.plotIndex === index);

  let tileColor = "#b6c7bd";
  if (plot.unlocked) tileColor = plot.crop?.watered ? "#74513d" : "#9b6a4c";
  if (plot.crop?.fertilized) tileColor = "#82633a";

  let label: string | null = null;
  if (!plot.unlocked) label = `${PLOT_UNLOCK_COSTS[index]}G`;
  else if (status) label = status.wilted ? "시듦" : status.isReady ? "수확!" : formatDuration(status.remaining);

  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, 0.1, 0]}
        onClick={(event) => {
          event.stopPropagation();
          selectPlot(index);
        }}
      >
        <boxGeometry args={[1.1, 0.2, 1.1]} />
        <meshStandardMaterial color={tileColor} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <ringGeometry args={[0.72, 0.82, 4]} />
          <meshBasicMaterial color="#f2bc46" />
        </mesh>
      )}
      {status && (
        <group position={[0, 0.2, 0]}>
          <CropModel type={plot.crop!.type} stage={status.stage} wilted={status.wilted} />
        </group>
      )}
      {careEffects.map((effect) => (
        <CareBurst effect={effect} key={effect.id} />
      ))}
      {status?.isReady && !status.wilted && <ReadyMarker />}
      {label && (
        <Html center position={[0, plot.unlocked ? 1.35 : 0.5, 0]} style={{ pointerEvents: "none" }}>
          <span className={`plot-tag ${status?.isReady && !status.wilted ? "plot-tag--ready" : ""}`}>{label}</span>
        </Html>
      )}
    </group>
  );
}

function HarvestEffect({ effect }: { effect: HarvestEffectType }) {
  const group = useRef<Group>(null);
  const startedAt = useRef<number | null>(null);
  const [x, z] = plotPosition(effect.plotIndex);

  useFrame((state) => {
    if (!group.current) return;
    if (startedAt.current === null) startedAt.current = state.clock.elapsedTime;
    const progress = Math.min(1, (state.clock.elapsedTime - startedAt.current) / 0.82);
    const scale = 1.15 + Math.sin(progress * Math.PI) * 0.55;
    group.current.scale.setScalar(scale);
    group.current.position.y = 0.28 + progress * 0.5;
  });

  return (
    <group ref={group} position={[x, 0.28, z]}>
      <CropModel type={effect.cropType} stage="ready" wilted={effect.quality === "wilted"} />
      {effect.quality === "gold" &&
        Array.from({ length: 8 }, (_, index) => {
          const angle = (index / 8) * Math.PI * 2;
          return (
            <mesh key={index} position={[Math.cos(angle) * 0.42, 0.32 + (index % 2) * 0.12, Math.sin(angle) * 0.42]}>
              <sphereGeometry args={[0.045, 8, 6]} />
              <meshStandardMaterial color="#f2bc46" emissive="#f2bc46" emissiveIntensity={0.55} />
            </mesh>
          );
        })}
      <Html center position={[0, 1.0, 0]} style={{ pointerEvents: "none" }}>
        <span className={`floating-gain floating-gain--${effect.quality}`}>{effect.label}</span>
      </Html>
    </group>
  );
}

function GardenWorld({ palette, night }: { palette: ScenePalette; night: boolean }) {
  const game = useGameStore((store) => store.game);
  const harvestEffects = useGameStore((store) => store.harvestEffects);
  const activeCritters = useGameStore((store) => store.activeCritters);
  const litLampIds = game.decorations
    .filter((decoration) => decoration.type === "lamp" && isDecorationPlaced(decoration))
    .slice(0, 4)
    .map((decoration) => decoration.id);

  return (
    <>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={GARDEN_ISLAND_GEOMETRY.top} />
        <meshStandardMaterial color={palette.gardenGrass} flatShading />
      </mesh>
      <mesh position={[0, -0.42, 0]}>
        <cylinderGeometry args={GARDEN_ISLAND_GEOMETRY.bottom} />
        <meshStandardMaterial color={palette.gardenSide} flatShading />
      </mesh>
      {GARDEN_TREES.map((tree) => (
        <Tree key={`${tree.position[0]}:${tree.position[2]}`} position={tree.position} scale={tree.scale} palette={palette} />
      ))}
      <PortalSign scene="garden" />
      <CompostBin />
      {game.decorations.filter(isDecorationPlaced).map((decoration) => (
        <DecorationObject
          decoration={decoration}
          key={decoration.id}
          lit={night && decoration.type === "lamp" && litLampIds.includes(decoration.id)}
        />
      ))}
      {activeCritters.map((critter) => (
        <CritterAgent critter={critter} key={critter.id} />
      ))}
      {Array.from({ length: PLOT_COUNT }, (_, index) => (
        <PlotTile key={index} index={index} />
      ))}
      {harvestEffects.map((effect) => (
        <HarvestEffect effect={effect} key={effect.id} />
      ))}
    </>
  );
}

function DecorationObject({ decoration, lit }: { decoration: PlacedDecoration & { x: number; z: number }; lit: boolean }) {
  return (
    <group position={[decoration.x, 0.08, decoration.z]} rotation={[0, decoration.rotY, 0]}>
      <DecorationModel type={decoration.type} />
      {lit && (
        <>
          <pointLight color="#ffd86f" intensity={0.9} distance={2.25} position={[0, 1.0, 0]} />
          <mesh position={[0, 0.92, 0]}>
            <sphereGeometry args={[0.18, 12, 8]} />
            <meshBasicMaterial color="#ffe8a3" transparent opacity={0.26} />
          </mesh>
        </>
      )}
    </group>
  );
}

function CompostBin() {
  const game = useGameStore((store) => store.game);
  const now = useGameStore((store) => store.now);
  const filledSlots = game.compost.slots.filter(Boolean);
  const readyCount = game.compost.slots.filter((slot) => slot && getCompostRemainingMs(slot, now) <= 0).length;
  const remaining = filledSlots
    .map((slot) => getCompostRemainingMs(slot, now))
    .filter((value) => value > 0)
    .sort((a, b) => a - b)[0];
  const label = readyCount > 0 ? "완성!" : remaining ? formatDuration(remaining) : null;

  return (
    <group position={COMPOST_POSITION}>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.66, 0.42, 0.52]} />
        <meshStandardMaterial color="#8d6546" />
      </mesh>
      <mesh position={[0, 0.48, 0]} scale={[1, 0.36, 0.78]}>
        <sphereGeometry args={[0.26, 12, 8]} />
        <meshStandardMaterial color="#5b4032" />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.46, 16]} />
        <meshBasicMaterial color="#fff0a8" transparent opacity={0.45} />
      </mesh>
      {label && (
        <Html center position={[0, 1.0, 0]} style={{ pointerEvents: "none" }}>
          <span className={`plot-tag ${readyCount > 0 ? "plot-tag--ready" : ""}`}>{label}</span>
        </Html>
      )}
    </group>
  );
}

function isCritterPointClear(x: number, z: number): boolean {
  if (Math.hypot(x, z) > ISLAND_RADIUS - 0.45) return false;
  return !PLOT_COLLIDERS.some((plot) => circleOverlapsAabb(x, z, 0.24, plot.x, plot.z, PLOT_HALF_SIZE + 0.08, PLOT_HALF_SIZE + 0.08));
}

function pickCritterWanderTarget(origin: Vector3): Vector3 {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 0.75 + Math.random() * 1.1;
    const x = origin.x + Math.cos(angle) * distance;
    const z = origin.z + Math.sin(angle) * distance;
    if (isCritterPointClear(x, z)) return new Vector3(x, 0.08, z);
  }
  return new Vector3(origin.x, 0.08, origin.z);
}

function HeartBurst() {
  const group = useRef<Group>(null);
  const startedAt = useRef<number | null>(null);

  useFrame((state) => {
    if (!group.current) return;
    if (startedAt.current === null) startedAt.current = state.clock.elapsedTime;
    const progress = Math.min(1, (state.clock.elapsedTime - startedAt.current) / 0.8);
    group.current.position.y = 0.45 + progress * 0.5;
    group.current.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.35);
  });

  return (
    <group ref={group}>
      {[-0.1, 0, 0.1].map((x, index) => (
        <mesh key={index} position={[x, 0.28 + index * 0.08, 0]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshStandardMaterial color="#f28aa8" emissive="#f28aa8" emissiveIntensity={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function CritterAgent({ critter }: { critter: ActiveCritter }) {
  const group = useRef<Group>(null);
  const target = useRef(new Vector3(critter.x, 0.08, critter.z));

  useEffect(() => {
    critterPositions.set(critter.id, new Vector3(critter.x, 0.08, critter.z));
    return () => {
      critterPositions.delete(critter.id);
    };
  }, [critter.id, critter.x, critter.z]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const current = group.current.position;
    if (current.distanceTo(target.current) < 0.08) {
      target.current = pickCritterWanderTarget(current);
    }

    const dx = target.current.x - current.x;
    const dz = target.current.z - current.z;
    const length = Math.hypot(dx, dz);
    if (length > 0.001) {
      const speed = critter.type === "butterfly" ? 0.42 : 0.26;
      current.x += (dx / length) * speed * delta;
      current.z += (dz / length) * speed * delta;
      group.current.rotation.y = angleLerp(group.current.rotation.y, Math.atan2(dx, dz), Math.min(1, delta * 5));
    }
    current.y = (critter.type === "butterfly" ? 0.34 : 0.08) + Math.sin(state.clock.elapsedTime * 2.2 + critter.seed) * 0.035;
    critterPositions.set(critter.id, current.clone());
  });

  return (
    <group ref={group} position={[critter.x, 0.08, critter.z]} scale={critter.type === "butterfly" ? 1.05 : 1}>
      <CritterModel type={critter.type} />
      {critter.heartPulse > 0 && <HeartBurst key={critter.heartPulse} />}
    </group>
  );
}

function Tree({ position, scale = 1, palette }: { position: [number, number, number]; scale?: number; palette: ScenePalette }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 0.7, 7]} />
        <meshStandardMaterial color={palette.trunk} />
      </mesh>
      <mesh position={[0, 0.92, 0]}>
        <coneGeometry args={[0.48, 0.95, 8]} />
        <meshStandardMaterial color={palette.treeDark} flatShading />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <coneGeometry args={[0.36, 0.75, 8]} />
        <meshStandardMaterial color={palette.treeLight} flatShading />
      </mesh>
    </group>
  );
}

function PortalSign({ scene }: { scene: SceneId }) {
  const portal = PORTALS[scene];
  const [x, y, z] = portal.position;
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.025, scene === "garden" ? 0.18 : -0.18]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.1, 0.62]} />
        <meshStandardMaterial color="#d5b181" transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.045, 0.06, 0.7, 6]} />
        <meshStandardMaterial color="#8d6546" flatShading />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[0.72, 0.28, 0.08]} />
        <meshStandardMaterial color="#b98258" flatShading />
      </mesh>
      <Html center position={[0, 0.79, scene === "garden" ? 0.07 : -0.07]} style={{ pointerEvents: "none" }}>
        <span className="portal-tag">{portal.sign}</span>
      </Html>
    </group>
  );
}

function ForageModel({ itemId, collected }: { itemId: string; collected: boolean }) {
  const opacity = collected ? 0.32 : 1;
  if (itemId === "mushroom") {
    return (
      <group>
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.055, 0.075, 0.26, 8]} />
          <meshStandardMaterial color="#f3dfc5" transparent opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#cf6e5d" transparent opacity={opacity} />
        </mesh>
      </group>
    );
  }

  if (itemId === "berry") {
    return (
      <group>
        {[
          [-0.08, 0.18, 0],
          [0.08, 0.2, 0.04],
          [0, 0.29, -0.04],
        ].map((position, index) => (
          <mesh key={index} position={position as [number, number, number]}>
            <sphereGeometry args={[0.085, 10, 8]} />
            <meshStandardMaterial color="#8c4fa3" transparent opacity={opacity} />
          </mesh>
        ))}
      </group>
    );
  }

  if (itemId === "wildflower") {
    return (
      <group>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.018, 0.024, 0.34, 6]} />
          <meshStandardMaterial color="#5fae69" transparent opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color="#f0a1bd" transparent opacity={opacity} />
        </mesh>
      </group>
    );
  }

  if (itemId === "clover") {
    return (
      <group>
        {Array.from({ length: 4 }, (_, index) => {
          const angle = (index / 4) * Math.PI * 2;
          return (
            <mesh key={index} position={[Math.cos(angle) * 0.07, 0.2, Math.sin(angle) * 0.07]} scale={[1, 0.55, 1]}>
              <sphereGeometry args={[0.09, 10, 8]} />
              <meshStandardMaterial color="#4da45d" transparent opacity={opacity} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (itemId === "cherry_petal") {
    return (
      <group>
        <mesh position={[0, 0.24, 0]} rotation={[0.25, 0, 0.4]} scale={[1.35, 0.45, 0.08]}>
          <sphereGeometry args={[0.13, 10, 8]} />
          <meshStandardMaterial color="#f4a8bd" transparent opacity={opacity} />
        </mesh>
      </group>
    );
  }

  if (itemId === "cicada_shell") {
    return (
      <group>
        <mesh position={[0, 0.23, 0]} scale={[0.8, 1.05, 0.55]}>
          <sphereGeometry args={[0.14, 10, 8]} />
          <meshStandardMaterial color="#d1a66e" transparent opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.34, -0.03]} scale={[0.55, 0.45, 0.4]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshStandardMaterial color="#e4c38c" transparent opacity={opacity} />
        </mesh>
      </group>
    );
  }

  if (itemId === "acorn") {
    return (
      <group>
        <mesh position={[0, 0.21, 0]}>
          <sphereGeometry args={[0.13, 10, 8]} />
          <meshStandardMaterial color="#9a603b" transparent opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.34, 0]}>
          <sphereGeometry args={[0.12, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#6f5132" transparent opacity={opacity} />
        </mesh>
      </group>
    );
  }

  if (itemId === "snow_crystal") {
    return (
      <group>
        {Array.from({ length: 6 }, (_, index) => (
          <mesh key={index} position={[0, 0.25, 0]} rotation={[0, (index / 6) * Math.PI * 2, 0]}>
            <boxGeometry args={[0.035, 0.035, 0.32]} />
            <meshStandardMaterial color="#d8f2ff" emissive="#bde9ff" emissiveIntensity={0.4} transparent opacity={opacity} />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.12, 12, 8]} />
        <meshStandardMaterial color="#98d6ff" emissive="#7fc8ff" emissiveIntensity={collected ? 0.1 : 0.75} transparent opacity={opacity} />
      </mesh>
      <pointLight color="#8dd8ff" intensity={collected ? 0 : 0.55} distance={1.2} />
    </group>
  );
}

function ForageSpot({ index }: { index: number }) {
  const spot = useGameStore((store) => store.game.gather.spots[index]);
  const selected = useGameStore((store) => store.selectedForage === index);
  const nearby = useGameStore((store) => store.nearbyInteraction?.target.kind === "forage" && store.nearbyInteraction.target.index === index);
  const selectForage = useGameStore((store) => store.selectForage);
  const group = useRef<Group>(null);
  const [x, z] = forestPosition(index);
  const item = FORAGE_DEFS[spot.item];

  useFrame((state) => {
    if (!group.current || spot.collected) return;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 2.2 + index) * 0.08;
    group.current.rotation.y += 0.012;
  });

  return (
    <group
      ref={group}
      position={[x, 0.05, z]}
      onClick={(event) => {
        event.stopPropagation();
        selectForage(index);
      }}
      scale={spot.collected ? 0.62 : 1}
    >
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.28, 0.34, 0.06, 12]} />
        <meshStandardMaterial color={spot.collected ? "#8aac83" : "#c7e6a1"} transparent opacity={spot.collected ? 0.42 : 0.8} />
      </mesh>
      <ForageModel itemId={spot.item} collected={spot.collected} />
      {!spot.collected && (
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={selected || nearby ? [0.38, 0.47, 24] : [0.34, 0.4, 24]} />
          <meshBasicMaterial color={selected || nearby ? "#f2bc46" : item.nightOnly ? "#9dd9ff" : "#fff0a8"} transparent opacity={0.86} />
        </mesh>
      )}
      {!spot.collected && (
        <Html center position={[0, 0.72, 0]} style={{ pointerEvents: "none" }}>
          <span className="forage-tag">{item.name}</span>
        </Html>
      )}
    </group>
  );
}

function Fireflies() {
  const night = useGameStore((store) => isNightTime(store.now));
  if (!night) return null;

  return (
    <>
      {Array.from({ length: 10 }, (_, index) => {
        const x = ((index % 5) - 2) * 0.85;
        const z = (Math.floor(index / 5) - 0.5) * 1.7;
        return (
          <mesh key={index} position={[x, 0.75 + (index % 3) * 0.16, z]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color="#b9f6ff" emissive="#8dd8ff" emissiveIntensity={0.9} />
          </mesh>
        );
      })}
    </>
  );
}

type ParticleKind = "petal" | "rain" | "leaf" | "snow";

function getParticleKind(season: SeasonId, weather: WeatherId): ParticleKind | null {
  if (season === "spring") return "petal";
  if (season === "autumn") return "leaf";
  if (season === "summer" && weather === "rain") return "rain";
  if (season === "winter" && weather === "snow") return "snow";
  return null;
}

function SeasonalParticles({ season, weather }: { season: SeasonId; weather: WeatherId }) {
  const kind = getParticleKind(season, weather);
  const dummy = useMemo(() => new Object3D(), []);
  const mesh = useRef<InstancedMesh>(null);
  const particles = useMemo(() => {
    if (!kind) return [];
    const count = kind === "rain" ? 40 : 28;
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 8,
      y: 0.8 + Math.random() * 3.2,
      z: (Math.random() - 0.5) * 8,
      drift: (Math.random() - 0.5) * (kind === "snow" ? 0.35 : 0.18),
      spin: Math.random() * Math.PI * 2,
      speed: kind === "rain" ? 2.9 + Math.random() * 0.9 : kind === "snow" ? 0.32 + Math.random() * 0.18 : 0.26 + Math.random() * 0.16,
    }));
  }, [kind]);

  useFrame((state, delta) => {
    if (!mesh.current || !kind) return;
    mesh.current.count = particles.length;
    particles.forEach((particle, index) => {
      particle.y -= particle.speed * delta;
      particle.x += Math.sin(state.clock.elapsedTime + particle.spin) * particle.drift * delta;
      particle.z += (kind === "rain" ? 0.42 : Math.cos(state.clock.elapsedTime * 0.8 + particle.spin) * 0.16) * delta;
      particle.spin += delta * (kind === "rain" ? 0.2 : 1.5);
      if (particle.y < 0.08) {
        particle.x = (Math.random() - 0.5) * 8;
        particle.y = 3.4 + Math.random() * 1.2;
        particle.z = (Math.random() - 0.5) * 8;
      }

      dummy.position.set(particle.x, particle.y, particle.z);
      dummy.rotation.set(kind === "rain" ? -0.22 : particle.spin, 0, kind === "rain" ? 0.12 : particle.spin * 0.5);
      dummy.scale.setScalar(kind === "rain" ? 1 : 0.8 + Math.sin(particle.spin) * 0.12);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  if (!kind) return null;

  const color = kind === "petal" ? "#f2a2c0" : kind === "leaf" ? "#d58744" : kind === "snow" ? "#f1fbff" : "#8ec9ee";
  const opacity = kind === "rain" ? 0.48 : 0.74;

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, particles.length]}>
      {kind === "rain" ? <boxGeometry args={[0.018, 0.26, 0.018]} /> : <planeGeometry args={[0.13, 0.06]} />}
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </instancedMesh>
  );
}

function ForestWorld({ palette }: { palette: ScenePalette }) {
  const game = useGameStore((store) => store.game);
  const now = useGameStore((store) => store.now);
  const startGatherRound = useGameStore((store) => store.startGatherRound);
  const allCollected = game.gather.spots.every((spot) => spot.collected);

  return (
    <>
      <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={FOREST_ISLAND_GEOMETRY.top} />
        <meshStandardMaterial color={palette.forestGrass} flatShading />
      </mesh>
      <mesh position={[0, -0.45, 0]}>
        <cylinderGeometry args={FOREST_ISLAND_GEOMETRY.bottom} />
        <meshStandardMaterial color={palette.forestSide} flatShading />
      </mesh>
      {FOREST_TREES.map((tree) => (
        <Tree key={`${tree.position[0]}:${tree.position[2]}`} position={tree.position} scale={tree.scale} palette={palette} />
      ))}
      <PortalSign scene="forest" />
      {game.gather.spots.map((spot, index) => (
        <ForageSpot index={index} key={spot.id} />
      ))}
      <Fireflies />
      {allCollected && (
        <Html center position={[0, 1.55, 0]}>
          <div className="forest-empty-card">
            <strong>채집 완료</strong>
            <span>예비 리필 {game.gather.charges}회 · 다음 리필 {formatDuration(getGatherRemainingMs(game, now))}</span>
            <button className="item-button secondary" type="button" disabled={game.gather.charges <= 0} onClick={startGatherRound}>
              새 포인트 펼치기
            </button>
          </div>
        </Html>
      )}
    </>
  );
}

function SunOrMoon({ night }: { night: boolean }) {
  return (
    <group position={[2.4, 3.2, -2.3]}>
      <mesh>
        <sphereGeometry args={[0.28, 18, 12]} />
        <meshStandardMaterial color={night ? "#d7e9ff" : "#ffd86f"} emissive={night ? "#8db7ff" : "#f2bc46"} emissiveIntensity={night ? 0.45 : 0.7} />
      </mesh>
      {night && (
        <mesh position={[0.11, 0.08, 0.03]}>
          <sphereGeometry args={[0.23, 18, 12]} />
          <meshStandardMaterial color="#17233b" />
        </mesh>
      )}
    </group>
  );
}

export function GardenScene() {
  const scene = useGameStore((store) => store.game.scene);
  const now = useGameStore((store) => store.now);
  const night = isNightTime(now);
  const season = getSeason(now);
  const weather = getWeather(now);
  const palette = getScenePalette(season, night);

  return (
    <Canvas
      camera={{ position: INITIAL_CAMERA_POSITION, fov: 40 }}
      dpr={[1, 1.5]}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
    >
      <color attach="background" args={[palette.background]} />
      <ambientLight intensity={night ? 0.34 : 0.75} color={night ? "#9db8ff" : "#ffffff"} />
      <directionalLight position={[4, 8, 4]} intensity={night ? 0.56 : 1.1} color={night ? "#bcd4ff" : "#ffffff"} />
      <SunOrMoon night={night} />
      <SeasonalParticles season={season} weather={weather} />
      {scene === "garden" ? <GardenWorld palette={palette} night={night} /> : <ForestWorld palette={palette} />}
      <PlayerController />
    </Canvas>
  );
}
