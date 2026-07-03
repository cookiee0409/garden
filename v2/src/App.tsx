import { BALANCE_LABEL, CODEX_REWARDS, CROP_DEFS, FERTILIZER_RECIPE, PLOT_UNLOCK_COSTS } from "./game/data";
import {
  findInventoryCropKey,
  formatDuration,
  getCodexCount,
  getCropStatus,
  getGatherRemainingMs,
  getItemInfo,
  getPossibleCodexEntries,
  isNightTime,
  makeItemKey,
} from "./game/logic";
import { useGameStore } from "./game/store";
import { GardenScene } from "./scene/GardenScene";

function ResourceStrip() {
  const game = useGameStore((store) => store.game);
  const unlocked = game.plots.filter((plot) => plot.unlocked).length;
  const seedCount = Object.values(game.seeds).reduce((sum, value) => sum + value, 0);
  const cropCount = game.plots.filter((plot) => plot.crop).length;

  return (
    <div className="resource-strip">
      <span className="resource-pill">골드 <strong>{game.gold}G</strong></span>
      <span className="resource-pill">씨앗 <strong>{seedCount}개</strong></span>
      <span className="resource-pill">밭 <strong>{unlocked}/9</strong></span>
      <span className="resource-pill">재배 <strong>{cropCount}칸</strong></span>
      <span className="resource-pill">출석 <strong>{game.streak}일</strong></span>
      <span className="resource-pill">물뿌리개 <strong>{game.goldenWater}회</strong></span>
      <span className="resource-pill">비료 <strong>{game.fertilizer}개</strong></span>
    </div>
  );
}

function SceneToolbar() {
  const scene = useGameStore((store) => store.game.scene);
  const switchScene = useGameStore((store) => store.switchScene);

  return (
    <div className="scene-toolbar" role="tablist" aria-label="장소 선택">
      <button
        className={`tab-button ${scene === "garden" ? "active" : ""}`}
        type="button"
        role="tab"
        aria-selected={scene === "garden"}
        onClick={() => switchScene("garden")}
      >
        정원
      </button>
      <button
        className={`tab-button ${scene === "forest" ? "active" : ""}`}
        type="button"
        role="tab"
        aria-selected={scene === "forest"}
        onClick={() => switchScene("forest")}
      >
        숲 입구
      </button>
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

function PlotDetails() {
  const game = useGameStore((store) => store.game);
  const now = useGameStore((store) => store.now);
  const clickPlot = useGameStore((store) => store.clickPlot);
  const useGoldenWater = useGameStore((store) => store.useGoldenWater);
  const useFertilizer = useGameStore((store) => store.useFertilizer);
  const startGatherRound = useGameStore((store) => store.startGatherRound);

  if (game.scene === "forest") {
    const allCollected = game.gather.spots.every((spot) => spot.collected);
    const remaining = formatDuration(getGatherRemainingMs(game, now));
    return (
      <div className="plot-details">
        <p className="detail-copy">
          예비 리필 {game.gather.charges}회 · 다음 리필 {remaining}
          {isNightTime(now) ? " · 밤빛 조각 출현 중" : ""}
        </p>
        <button
          className="primary-button secondary"
          type="button"
          disabled={!allCollected || game.gather.charges <= 0}
          onClick={startGatherRound}
        >
          새 포인트 펼치기
        </button>
      </div>
    );
  }

  const index = game.selectedPlot;
  const plot = Number.isInteger(index) && index !== null ? game.plots[index] : null;
  if (!plot || index === null) {
    return (
      <div className="plot-details">
        <p className="detail-copy">선택한 씨앗: {CROP_DEFS[game.selectedSeed].name}</p>
      </div>
    );
  }

  if (!plot.unlocked) {
    const unlockCost = PLOT_UNLOCK_COSTS[index] || 0;
    return (
      <div className="plot-details">
        <p className="detail-copy">잠긴 밭 · 확장 비용 {unlockCost}G</p>
        <button className="primary-button" type="button" disabled={game.gold < unlockCost} onClick={() => clickPlot(index)}>
          확장
        </button>
      </div>
    );
  }

  if (!plot.crop) {
    const crop = CROP_DEFS[game.selectedSeed];
    const count = game.seeds[crop.id] || 0;
    return (
      <div className="plot-details">
        <p className="detail-copy">
          {crop.name} · 성장 {formatDuration(crop.growMs)} · 기본 판매가 {crop.sellPrice}G · 보유 {count}개
        </p>
        <button className="primary-button" type="button" disabled={count <= 0} onClick={() => clickPlot(index)}>
          심기
        </button>
      </div>
    );
  }

  const status = getCropStatus(plot, now);
  return (
    <div className="plot-details">
      <p className="detail-copy">
        {status.def.name} {Math.round(status.progress * 100)}% ·{" "}
        {status.isReady
          ? status.wilted
            ? "시든 품질"
            : "수확 가능"
          : `남은 시간 ${formatDuration(status.remaining)}`}
        {plot.crop.watered ? " · 물줌" : ""}
        {plot.crop.fertilized ? " · 비료" : ""}
      </p>
      {status.isReady ? (
        <button className="primary-button" type="button" onClick={() => clickPlot(index)}>
          수확
        </button>
      ) : (
        <>
          <button className="primary-button secondary" type="button" disabled={plot.crop.watered} onClick={() => clickPlot(index)}>
            물주기
          </button>
          <button className="primary-button warning" type="button" disabled={game.goldenWater <= 0} onClick={() => useGoldenWater(index)}>
            황금 물뿌리개
          </button>
          <button className="primary-button" type="button" disabled={game.fertilizer <= 0 || plot.crop.fertilized} onClick={() => useFertilizer(index)}>
            비료 사용
          </button>
        </>
      )}
    </div>
  );
}

function VisitorPanel() {
  const game = useGameStore((store) => store.game);
  const deliverVisitorOrder = useGameStore((store) => store.deliverVisitorOrder);
  const visitor = game.dailyVisitor;

  if (!visitor) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <h2>오늘의 손님</h2>
        </div>
        <p className="empty-state">오늘은 조용합니다.</p>
      </section>
    );
  }

  const crop = CROP_DEFS[visitor.cropType];
  const hasCrop = Boolean(findInventoryCropKey(game, visitor.cropType));
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{visitor.name}의 요청</h2>
        <span className="soft-badge">{visitor.done ? "완료" : `x${visitor.bonus}`}</span>
      </div>
      <div className="visitor-card">
        <p>{crop.name} 수확물을 {visitor.bonus}배 가격으로 정산합니다.</p>
        <button className="primary-button" type="button" disabled={visitor.done || !hasCrop} onClick={deliverVisitorOrder}>
          {visitor.done ? "요청 완료" : `${crop.name} 납품`}
        </button>
      </div>
    </section>
  );
}

function ShopPanel() {
  const game = useGameStore((store) => store.game);
  const buySeed = useGameStore((store) => store.buySeed);
  const count = getCodexCount(game);

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>씨앗 상점</h2>
        <span className="soft-badge">{BALANCE_LABEL}</span>
      </div>
      <div className="stack-list">
        {Object.values(CROP_DEFS).map((crop) => {
          const locked = Boolean(crop.unlockCodex && count < crop.unlockCodex);
          return (
            <div className="list-row" key={crop.id}>
              <div>
                <strong>{crop.name} 씨앗</strong>
                <small>{crop.note} · {formatDuration(crop.growMs)} · 판매가 {crop.sellPrice}G</small>
              </div>
              <div className="row-actions">
                <button
                  className={`item-button ${locked ? "secondary" : ""}`}
                  type="button"
                  disabled={locked || game.gold < crop.seedCost}
                  onClick={() => buySeed(crop.id)}
                >
                  {locked ? `도감 ${crop.unlockCodex}` : `${crop.seedCost}G`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InventoryPanel() {
  const game = useGameStore((store) => store.game);
  const sellItem = useGameStore((store) => store.sellItem);
  const sellAll = useGameStore((store) => store.sellAll);
  const craftFertilizer = useGameStore((store) => store.craftFertilizer);
  const entries = Object.entries(game.inventory)
    .filter(([, quantity]) => quantity > 0)
    .sort(([a], [b]) => getItemInfo(a).name.localeCompare(getItemInfo(b).name, "ko"));
  const canCraft = Object.entries(FERTILIZER_RECIPE).every(([itemId, amount]) => {
    const key = makeItemKey("forage", itemId, "normal");
    return (game.inventory[key] || 0) >= amount;
  });

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>인벤토리</h2>
        <button className="mini-button" type="button" onClick={sellAll}>
          모두 판매
        </button>
      </div>
      <div className="craft-row">
        <span>비료 {game.fertilizer}개</span>
        <button className="item-button secondary" type="button" disabled={!canCraft} onClick={craftFertilizer}>
          제작
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="empty-state">보관 중인 수확물이나 채집물이 없습니다.</p>
      ) : (
        <div className="stack-list">
          {entries.map(([key, quantity]) => {
            const item = getItemInfo(key);
            return (
              <div className="list-row" key={key}>
                <div>
                  <strong className={item.qualityClass}>{item.name} x {quantity}</strong>
                  <small>개당 {item.sellPrice}G</small>
                </div>
                <div className="row-actions">
                  <button className="item-button" type="button" onClick={() => sellItem(key)}>
                    판매
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CodexPanel() {
  const game = useGameStore((store) => store.game);
  const claimReward = useGameStore((store) => store.claimReward);
  const possible = getPossibleCodexEntries();
  const count = getCodexCount(game);

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>도감</h2>
        <span className="soft-badge">{count}/{possible.length}</span>
      </div>
      <div className="codex-grid">
        {possible.map((entry) => {
          const found = Boolean(game.codex[entry.key]);
          return (
            <div className={`codex-tile ${found ? "is-found" : ""}`} key={entry.key}>
              {found ? entry.label : "???"}
            </div>
          );
        })}
      </div>
      <div className="reward-list">
        {CODEX_REWARDS.map((reward) => {
          const claimed = game.claimedRewards.includes(reward.id);
          const ready = count >= reward.required && !claimed;
          return (
            <div className="list-row" key={reward.id}>
              <div>
                <strong>{reward.title}</strong>
                <small>{reward.required}칸 필요 · {reward.description}</small>
              </div>
              <div className="row-actions">
                <button className={`item-button ${claimed ? "secondary" : ""}`} type="button" disabled={!ready} onClick={() => claimReward(reward.id)}>
                  {claimed ? "완료" : "받기"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HiddenPlotStatus() {
  const game = useGameStore((store) => store.game);
  const now = useGameStore((store) => store.now);

  return (
    <ul className="sr-only">
      {game.plots.map((plot, index) => {
        if (!plot.unlocked) return <li key={plot.id}>밭 {index + 1}: 잠김</li>;
        if (!plot.crop) return <li key={plot.id}>밭 {index + 1}: 비어 있음</li>;

        const status = getCropStatus(plot, now);
        return (
          <li key={plot.id}>
            밭 {index + 1}: {status.def.name}, {status.isReady ? "수확 가능" : `${formatDuration(status.remaining)} 남음`}
          </li>
        );
      })}
    </ul>
  );
}

function SceneSection() {
  const now = useGameStore((store) => store.now);
  const night = isNightTime(now);

  return (
    <section className="play-area">
      <SceneToolbar />
      <section className={`scene-frame ${night ? "scene-frame--night" : ""}`} aria-label="3D 정원">
        <GardenScene />
      </section>
      <SeedBar />
      <PlotDetails />
      <HiddenPlotStatus />
    </section>
  );
}

function WelcomeModal() {
  const summary = useGameStore((store) => store.welcomeSummary);
  const dismissWelcome = useGameStore((store) => store.dismissWelcome);
  if (!summary) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <section className="welcome-modal">
        <p className="eyebrow">Welcome back</p>
        <h2 id="welcome-title">{formatDuration(summary.offlineMs)} 만의 접속</h2>
        <div className="summary-grid">
          <span>완성 작물 <strong>{summary.readyCrops}개</strong></span>
          <span>시든 작물 <strong>{summary.wiltedCrops}개</strong></span>
          <span>채집 리필 <strong>{summary.gatherRefilled ? "발생" : "없음"}</strong></span>
          <span>출석 보상 <strong>{summary.dailyReward ? "수령" : "유지"}</strong></span>
        </div>
        <button className="primary-button" type="button" onClick={dismissWelcome}>
          정원으로 돌아가기
        </button>
      </section>
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
  const resetGame = useGameStore((store) => store.resetGame);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Idle Garden</p>
          <h1>미니 정원</h1>
        </div>
        <ResourceStrip />
        <button className="ghost-button danger" type="button" onClick={resetGame}>
          초기화
        </button>
      </header>

      <section className="game-layout" aria-label="정원 게임">
        <SceneSection />
        <aside className="side-panels">
          <VisitorPanel />
          <ShopPanel />
          <InventoryPanel />
          <CodexPanel />
        </aside>
      </section>

      <WelcomeModal />
      <ToastStack />
    </main>
  );
}
