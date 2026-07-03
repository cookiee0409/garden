import { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Vector3 } from "three";
import type { Group, Mesh } from "three";
import { FORAGE_DEFS, FORAGE_POSITIONS, PLOT_UNLOCK_COSTS } from "../game/data";
import { getInteractionPrompt } from "../game/interactions";
import { formatDuration, getCropStatus, getGatherRemainingMs, isNightTime } from "../game/logic";
import { useGameStore } from "../game/store";
import type { CareEffect, GameState, HarvestEffect as HarvestEffectType, InteractionPrompt, InteractionTarget, PlayerSpawnId, SceneId } from "../game/types";
import { virtualInteraction, virtualMove } from "../input/playerInput";
import { CropModel } from "./CropModel";
import { PlayerModel } from "./PlayerModel";

function plotPosition(index: number): [number, number] {
  const row = Math.floor(index / 3);
  const col = index % 3;
  return [(col - 1) * 1.3, (row - 1) * 1.3];
}

function forestPosition(index: number): [number, number] {
  const position = FORAGE_POSITIONS[index % FORAGE_POSITIONS.length];
  return [(position.x / 100 - 0.5) * 5.6, (position.y / 100 - 0.5) * 4.8];
}

const PLAYER_SPEED = 2.2;
const PLAYER_RADIUS = 0.24;
const ISLAND_RADIUS = 3.05;
const INTERACTION_RADIUS = 0.9;
const CAMERA_OFFSET = new Vector3(5.2, 6.2, 5.2);

const SPAWN_POSITIONS: Record<PlayerSpawnId, [number, number, number]> = {
  "garden-default": [0, 0.05, 2.12],
  "garden-from-forest": [0, 0.05, 2.12],
  "forest-from-garden": [0, 0.05, -2.12],
};

const PORTALS: Record<SceneId, { target: InteractionTarget; position: [number, number, number]; sign: string }> = {
  garden: {
    target: { kind: "portal", id: "garden-to-forest", to: "forest" },
    position: [0, 0, 2.72],
    sign: "숲",
  },
  forest: {
    target: { kind: "portal", id: "forest-to-garden", to: "garden" },
    position: [0, 0, -2.72],
    sign: "정원",
  },
};

const GARDEN_TREE_COLLIDERS = [
  { x: -2.55, z: -1.75, radius: 0.28 },
  { x: 2.55, z: 1.55, radius: 0.28 },
];
const FOREST_TREE_COLLIDERS = [
  { x: -2.45, z: -1.65, radius: 0.3 },
  { x: 2.38, z: -1.2, radius: 0.28 },
  { x: -2.1, z: 1.65, radius: 0.25 },
  { x: 2.2, z: 1.4, radius: 0.29 },
];

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

function resolveCollisions(position: Vector3, scene: SceneId) {
  clampToIsland(position);

  if (scene === "garden") {
    Array.from({ length: 9 }, (_, index) => plotPosition(index)).forEach(([x, z]) => {
      resolveAabbCollision(position, x, z, 0.55, 0.55);
    });
    GARDEN_TREE_COLLIDERS.forEach((tree) => resolveCircleCollision(position, tree.x, tree.z, tree.radius));
  } else {
    FOREST_TREE_COLLIDERS.forEach((tree) => resolveCircleCollision(position, tree.x, tree.z, tree.radius));
  }

  clampToIsland(position);
}

function targetPosition(target: InteractionTarget): [number, number] {
  if (target.kind === "plot") return plotPosition(target.index);
  if (target.kind === "forage") return forestPosition(target.index);
  const portal = target.id === "garden-to-forest" ? PORTALS.garden : PORTALS.forest;
  return [portal.position[0], portal.position[2]];
}

function nearestInteraction(game: GameState, scene: SceneId, position: Vector3, now: number): InteractionPrompt | null {
  const targets: InteractionTarget[] =
    scene === "garden"
      ? [
          ...game.plots.map((_, index) => ({ kind: "plot", index }) as InteractionTarget),
          PORTALS.garden.target,
        ]
      : [
          ...game.gather.spots.reduce<InteractionTarget[]>((items, spot, index) => {
            if (!spot.collected) items.push({ kind: "forage", index });
            return items;
          }, []),
          PORTALS.forest.target,
        ];

  let nearestTarget: InteractionTarget | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  targets.forEach((target) => {
    const [x, z] = targetPosition(target);
    const distance = Math.hypot(position.x - x, position.z - z);
    if (distance > INTERACTION_RADIUS) return;
    if (distance < nearestDistance) {
      nearestTarget = target;
      nearestDistance = distance;
    }
  });

  return nearestTarget ? getInteractionPrompt(game, nearestTarget, now) : null;
}

function PlayerController() {
  const scene = useGameStore((store) => store.game.scene);
  const game = useGameStore((store) => store.game);
  const now = useGameStore((store) => store.now);
  const spawn = useGameStore((store) => store.playerSpawn);
  const setNearbyInteraction = useGameStore((store) => store.setNearbyInteraction);
  const performNearbyInteraction = useGameStore((store) => store.performNearbyInteraction);

  const player = useRef<Group>(null);
  const keys = useRef(new Set<string>());
  const gameRef = useRef(game);
  const nowRef = useRef(now);
  const sceneRef = useRef(scene);
  const nearbyRef = useRef<InteractionPrompt | null>(null);
  const walkingRef = useRef(false);
  const cameraTarget = useRef(new Vector3(0, 0.4, 0));
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
    const position = SPAWN_POSITIONS[spawn.id];
    player.current?.position.set(...position);
    cameraTarget.current.set(position[0], 0.4, position[2]);
    setNearbyInteraction(null);
  }, [setNearbyInteraction, spawn.id, spawn.version]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) return;
      if (event.code === "KeyE" || event.code === "Space") {
        event.preventDefault();
        const target = nearbyRef.current?.target;
        if (target && player.current) {
          const [x, z] = targetPosition(target);
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
  }, [performNearbyInteraction]);

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
      resolveCollisions(nextPosition.current, sceneRef.current);
      player.current.position.copy(nextPosition.current);
      player.current.rotation.y = angleLerp(player.current.rotation.y, Math.atan2(x, z), Math.min(1, delta * 12));
    }

    if (lastVirtualInteraction.current !== virtualInteraction.requestId) {
      lastVirtualInteraction.current = virtualInteraction.requestId;
      const target = nearbyRef.current?.target;
      if (target) {
        const [targetX, targetZ] = targetPosition(target);
        player.current.rotation.y = angleLerp(player.current.rotation.y, Math.atan2(targetX - player.current.position.x, targetZ - player.current.position.z), 0.65);
      }
      performNearbyInteraction();
    }

    const prompt = nearestInteraction(gameRef.current, sceneRef.current, player.current.position, nowRef.current);
    nearbyRef.current = prompt;
    setNearbyInteraction(prompt);

    cameraTarget.current.lerp(new Vector3(player.current.position.x, 0.42, player.current.position.z), 0.08);
    clampToIsland(cameraTarget.current);
    state.camera.position.lerp(cameraTarget.current.clone().add(CAMERA_OFFSET), 0.08);
    state.camera.lookAt(cameraTarget.current);
  });

  return (
    <group ref={player} position={SPAWN_POSITIONS[spawn.id]}>
      <PlayerModel walkingRef={walkingRef} />
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

function GardenWorld() {
  const harvestEffects = useGameStore((store) => store.harvestEffects);
  return (
    <>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[3.4, 3.8, 0.5, 8]} />
        <meshStandardMaterial color="#7cc98e" flatShading />
      </mesh>
      <mesh position={[0, -0.42, 0]}>
        <cylinderGeometry args={[3.8, 3.2, 0.4, 8]} />
        <meshStandardMaterial color="#a9724a" flatShading />
      </mesh>
      <Tree position={[-2.55, 0, -1.75]} scale={0.82} />
      <Tree position={[2.55, 0, 1.55]} scale={0.76} />
      <PortalSign scene="garden" />
      {Array.from({ length: 9 }, (_, index) => (
        <PlotTile key={index} index={index} />
      ))}
      {harvestEffects.map((effect) => (
        <HarvestEffect effect={effect} key={effect.id} />
      ))}
    </>
  );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 0.7, 7]} />
        <meshStandardMaterial color="#8d6546" />
      </mesh>
      <mesh position={[0, 0.92, 0]}>
        <coneGeometry args={[0.48, 0.95, 8]} />
        <meshStandardMaterial color="#4c9b63" flatShading />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <coneGeometry args={[0.36, 0.75, 8]} />
        <meshStandardMaterial color="#67b77a" flatShading />
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

function ForestWorld() {
  const game = useGameStore((store) => store.game);
  const now = useGameStore((store) => store.now);
  const startGatherRound = useGameStore((store) => store.startGatherRound);
  const allCollected = game.gather.spots.every((spot) => spot.collected);

  return (
    <>
      <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[3.5, 3.9, 0.48, 9]} />
        <meshStandardMaterial color="#5fae69" flatShading />
      </mesh>
      <mesh position={[0, -0.45, 0]}>
        <cylinderGeometry args={[3.9, 3.3, 0.4, 9]} />
        <meshStandardMaterial color="#7b5a43" flatShading />
      </mesh>
      <Tree position={[-2.45, 0.0, -1.65]} scale={1.12} />
      <Tree position={[2.38, 0.0, -1.2]} scale={0.95} />
      <Tree position={[-2.1, 0.0, 1.65]} scale={0.82} />
      <Tree position={[2.2, 0.0, 1.4]} scale={1.02} />
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

  return (
    <Canvas
      camera={{ position: [5.2, 6.2, 5.2], fov: 40 }}
      dpr={[1, 1.5]}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
    >
      <color attach="background" args={[night ? "#17233b" : "#dff4ec"]} />
      <ambientLight intensity={night ? 0.34 : 0.75} color={night ? "#9db8ff" : "#ffffff"} />
      <directionalLight position={[4, 8, 4]} intensity={night ? 0.56 : 1.1} color={night ? "#bcd4ff" : "#ffffff"} />
      <SunOrMoon night={night} />
      {scene === "garden" ? <GardenWorld /> : <ForestWorld />}
      <PlayerController />
    </Canvas>
  );
}
