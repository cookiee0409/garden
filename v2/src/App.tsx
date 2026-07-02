import { Canvas } from "@react-three/fiber";
import { useGameStore } from "./game/store";
import { PLOT_UNLOCK_COSTS } from "./game/data";
import { getCropStatus } from "./game/logic";

function PlotTile({ index }: { index: number }) {
  const plot = useGameStore((store) => store.game.plots[index]);
  const row = Math.floor(index / 3);
  const col = index % 3;
  const x = (col - 1) * 1.3;
  const z = (row - 1) * 1.3;

  let color = "#b6c7bd";
  if (plot.unlocked) color = plot.crop ? "#7a4c30" : "#9b6a4c";
  if (plot.crop && getCropStatus(plot).isReady) color = "#f2bc46";

  return (
    <mesh position={[x, 0.1, z]}>
      <boxGeometry args={[1.1, 0.2, 1.1]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function GardenScene() {
  return (
    <Canvas camera={{ position: [5, 6, 5], fov: 42 }} shadows>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 4]} intensity={1.1} />
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[3.4, 3.8, 0.5, 8]} />
        <meshStandardMaterial color="#7cc98e" />
      </mesh>
      {Array.from({ length: 9 }, (_, index) => (
        <PlotTile key={index} index={index} />
      ))}
    </Canvas>
  );
}

export default function App() {
  const game = useGameStore((store) => store.game);
  const unlocked = game.plots.filter((plot) => plot.unlocked).length;
  const seedCount = Object.values(game.seeds).reduce((sum, value) => sum + value, 0);
  const nextUnlockCost = PLOT_UNLOCK_COSTS[unlocked] ?? null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>미니 정원 v2</h1>
        <div className="resource-strip">
          <span className="resource-pill">골드 <strong>{game.gold}G</strong></span>
          <span className="resource-pill">씨앗 <strong>{seedCount}개</strong></span>
          <span className="resource-pill">밭 <strong>{unlocked}/9</strong></span>
          <span className="resource-pill">출석 <strong>{game.streak}일</strong></span>
          <span className="resource-pill">물뿌리개 <strong>{game.goldenWater}회</strong></span>
        </div>
      </header>
      <section className="scene-frame" aria-label="3D 정원">
        <GardenScene />
      </section>
      <p className="hint">
        REQ-20 세팅 확인용 화면입니다. 기존 저장(SAVE_KEY)을 읽어 위 수치를 표시하고,
        아래 3D 씬은 밭 상태(잠김/빈 밭/재배 중/수확 가능)를 색으로 보여줍니다.
        {nextUnlockCost !== null && ` 다음 밭 확장 비용은 ${nextUnlockCost}G입니다.`}
      </p>
    </main>
  );
}
