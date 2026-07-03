import { useGameStore } from "./game/store";
import { CROP_DEFS } from "./game/data";
import { GardenScene } from "./scene/GardenScene";

function ResourceStrip() {
  const game = useGameStore((store) => store.game);
  const unlocked = game.plots.filter((plot) => plot.unlocked).length;
  const seedCount = Object.values(game.seeds).reduce((sum, value) => sum + value, 0);

  return (
    <div className="resource-strip">
      <span className="resource-pill">골드 <strong>{game.gold}G</strong></span>
      <span className="resource-pill">씨앗 <strong>{seedCount}개</strong></span>
      <span className="resource-pill">밭 <strong>{unlocked}/9</strong></span>
      <span className="resource-pill">출석 <strong>{game.streak}일</strong></span>
      <span className="resource-pill">물뿌리개 <strong>{game.goldenWater}회</strong></span>
    </div>
  );
}

function SeedBar() {
  const seeds = useGameStore((store) => store.game.seeds);
  const selectedSeed = useGameStore((store) => store.game.selectedSeed);
  const selectSeed = useGameStore((store) => store.selectSeed);

  return (
    <div className="seed-bar" aria-label="씨앗 선택">
      {Object.values(CROP_DEFS).map((crop) => {
        const active = selectedSeed === crop.id;
        return (
          <button
            key={crop.id}
            type="button"
            className={`seed-chip ${active ? "active" : ""}`}
            aria-pressed={active}
            onClick={() => selectSeed(crop.id)}
          >
            <span className={`seed-dot seed-dot--${crop.className}`} aria-hidden="true" />
            <span>{crop.name}</span>
            <span className="muted">{seeds[crop.id] || 0}개</span>
          </button>
        );
      })}
    </div>
  );
}

function ToastStack() {
  const toasts = useGameStore((store) => store.toasts);
  return (
    <div className="toast-stack" aria-live="assertive">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>미니 정원 v2</h1>
        <ResourceStrip />
      </header>
      <section className="scene-frame" aria-label="3D 정원">
        <GardenScene />
      </section>
      <SeedBar />
      <p className="hint">
        씨앗을 고른 뒤 빈 밭을 누르면 심고, 다 자란 작물(반짝이는 표시)을 누르면 수확합니다.
        잠긴 밭은 표시된 골드를 내고 바로 확장됩니다.
      </p>
      <ToastStack />
    </main>
  );
}
