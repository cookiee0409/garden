import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Mesh } from "three";
import { useGameStore } from "../game/store";
import { PLOT_UNLOCK_COSTS } from "../game/data";
import { formatDuration, getCropStatus } from "../game/logic";
import { CropModel } from "./CropModel";

function plotPosition(index: number): [number, number] {
  const row = Math.floor(index / 3);
  const col = index % 3;
  return [(col - 1) * 1.3, (row - 1) * 1.3];
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

function PlotTile({ index }: { index: number }) {
  const plot = useGameStore((store) => store.game.plots[index]);
  const selected = useGameStore((store) => store.game.selectedPlot === index);
  const now = useGameStore((store) => store.now);
  const clickPlot = useGameStore((store) => store.clickPlot);
  const [x, z] = plotPosition(index);

  const status = plot.crop ? getCropStatus(plot, now) : null;

  let tileColor = "#b6c7bd";
  if (plot.unlocked) tileColor = plot.crop?.watered ? "#7a4c30" : "#9b6a4c";

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
      {status?.isReady && !status.wilted && <ReadyMarker />}
      {label && (
        <Html center position={[0, plot.unlocked ? 1.35 : 0.5, 0]} style={{ pointerEvents: "none" }}>
          <span className={`plot-tag ${status?.isReady && !status.wilted ? "plot-tag--ready" : ""}`}>{label}</span>
        </Html>
      )}
    </group>
  );
}

export function GardenScene() {
  return (
    <Canvas
      camera={{ position: [5.2, 6.2, 5.2], fov: 40 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 8, 4]} intensity={1.1} />
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
    </Canvas>
  );
}
