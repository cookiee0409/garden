import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group, Mesh } from "three";
import { FORAGE_DEFS, FORAGE_POSITIONS, PLOT_UNLOCK_COSTS } from "../game/data";
import { formatDuration, getCropStatus, getGatherRemainingMs, isNightTime } from "../game/logic";
import { useGameStore } from "../game/store";
import type { CareEffect, HarvestEffect as HarvestEffectType } from "../game/types";
import { CropModel } from "./CropModel";

function plotPosition(index: number): [number, number] {
  const row = Math.floor(index / 3);
  const col = index % 3;
  return [(col - 1) * 1.3, (row - 1) * 1.3];
}

function forestPosition(index: number): [number, number] {
  const position = FORAGE_POSITIONS[index % FORAGE_POSITIONS.length];
  return [(position.x / 100 - 0.5) * 5.6, (position.y / 100 - 0.5) * 4.8];
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
  const clickPlot = useGameStore((store) => store.clickPlot);
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
          clickPlot(index);
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
  const collectForage = useGameStore((store) => store.collectForage);
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
        collectForage(index);
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
          <ringGeometry args={[0.34, 0.4, 24]} />
          <meshBasicMaterial color={item.nightOnly ? "#9dd9ff" : "#fff0a8"} transparent opacity={0.82} />
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
    </Canvas>
  );
}
