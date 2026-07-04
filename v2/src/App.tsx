import { BALANCE_LABEL, CODEX_REWARDS, CROP_DEFS, DAILY_BAIT_MAX, DECOR_DEFS, FERTILIZER_RECIPE, PET_DEFS, PLOT_UNLOCK_COSTS, VISITORS } from "./game/data";
import {
  findWiltedInventoryKey,
  findInventoryCropKey,
  formatDuration,
  getCompostRemainingMs,
  getCodexCount,
  getCoziness,
  getCropStatus,
  getGatherRemainingMs,
  getItemInfo,
  getPossibleCodexEntries,
  getSeason,
  getSeasonName,
  getVisitorBonus,
  getWeather,
  getWeatherName,
  isDecorationPlaced,
  isNightTime,
  makeItemKey,
} from "./game/logic";
import { useGameStore } from "./game/store";
import { requestVirtualInteraction, setVirtualMove } from "./input/playerInput";
import { GardenScene } from "./scene/GardenScene";
import { useRef, useState, type PointerEvent } from "react";

function ResourceStrip() {
  const game = useGameStore((store) => store.game);
  const now = useGameStore((store) => store.now);
  const unlocked = game.plots.filter((plot) => plot.unlocked).length;
  const seedCount = Object.values(game.seeds).reduce((sum, value) => sum + value, 0);
  const cropCount = game.plots.filter((plot) => plot.crop).length;
  const season = getSeason(now);
  const weather = getWeather(now);

  return (
    <div className="resource-strip">
      <span className="resource-pill">골드 <strong>{game.gold}G</strong></span>
      <span className="resource-pill">씨앗 <strong>{seedCount}개</strong></span>
      <span className="resource-pill">밭 <strong>{unlocked}/9</strong></span>
      <span className="resource-pill">재배 <strong>{cropCount}칸</strong></span>
      <span className="resource-pill">출석 <strong>{game.streak}일</strong></span>
      <span className="resource-pill">물뿌리개 <strong>{game.goldenWater}회</strong></span>
      <span className="resource-pill">비료 <strong>{game.fertilizer}개</strong></span>
      <span className="resource-pill">미끼 <strong>{game.bait}/{DAILY_BAIT_MAX}</strong></span>
      <span className="resource-pill">아늑함 <strong>{getCoziness(game)}</strong></span>
      <span className="resource-pill">날씨 <strong>{getSeasonName(season)} · {getWeatherName(weather)}</strong></span>
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
      <button
        className={`tab-button ${scene === "pond" ? "active" : ""}`}
        type="button"
        role="tab"
        aria-selected={scene === "pond"}
        onClick={() => switchScene("pond")}
      >
        연못가
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
  const nearbyInteraction = useGameStore((store) => store.nearbyInteraction);
  const selectedForage = useGameStore((store) => store.selectedForage);
  const placementDecorationId = useGameStore((store) => store.placementDecorationId);
  const fishing = useGameStore((store) => store.fishing);
  const performPlotAction = useGameStore((store) => store.performPlotAction);
  const performForageAction = useGameStore((store) => store.performForageAction);
  const useGoldenWater = useGameStore((store) => store.useGoldenWater);
  const useFertilizer = useGameStore((store) => store.useFertilizer);
  const startGatherRound = useGameStore((store) => store.startGatherRound);
  const performFishingAction = useGameStore((store) => store.performFishingAction);
  const cancelDecorationPlacement = useGameStore((store) => store.cancelDecorationPlacement);
  const pickupDecoration = useGameStore((store) => store.pickupDecoration);
  const addWiltedToCompost = useGameStore((store) => store.addWiltedToCompost);
  const collectCompost = useGameStore((store) => store.collectCompost);
  const isPlotNear = (index: number) => nearbyInteraction?.target.kind === "plot" && nearbyInteraction.target.index === index;
  const isForageNear = (index: number) => nearbyInteraction?.target.kind === "forage" && nearbyInteraction.target.index === index;

  if (placementDecorationId) {
    const decoration = game.decorations.find((item) => item.id === placementDecorationId);
    return (
      <div className="plot-details">
        <p className="detail-copy">
          {decoration ? `${DECOR_DEFS[decoration.type].name} 배치 중` : "장식 배치 중"} · E 또는 터치 버튼으로 설치
        </p>
        <button className="primary-button secondary" type="button" onClick={cancelDecorationPlacement}>
          취소
        </button>
      </div>
    );
  }

  if (game.scene === "pond") {
    const nearFishing = nearbyInteraction?.target.kind === "fishingSpot";
    const biteReady = fishing.phase === "bite";
    const waiting = fishing.phase === "waiting";
    return (
      <div className="plot-details">
        <p className="detail-copy">
          낚시터 · 미끼 {game.bait}/{DAILY_BAIT_MAX}
          {waiting && fishing.biteAt ? ` · 입질까지 ${formatDuration(Math.max(0, fishing.biteAt - now))}` : ""}
          {biteReady ? " · 지금!" : ""}
          {!nearFishing ? " · 가까이 가야 합니다" : ""}
        </p>
        <button className={`primary-button ${biteReady ? "warning" : ""}`} type="button" disabled={!nearFishing || (game.bait <= 0 && fishing.phase === "idle")} onClick={performFishingAction}>
          {biteReady ? "낚아채기" : waiting ? "기다리기" : "낚시하기"}
        </button>
      </div>
    );
  }

  if (game.scene === "forest") {
    const selectedSpot = selectedForage !== null ? game.gather.spots[selectedForage] : null;
    if (selectedSpot && !selectedSpot.collected) {
      const near = isForageNear(selectedForage as number);
      return (
        <div className="plot-details">
          <p className="detail-copy">
            {getItemInfo(makeItemKey("forage", selectedSpot.item, "normal")).name}
            {!near ? " · 가까이 가야 합니다" : " · 채집 가능"}
          </p>
          <button className="primary-button" type="button" disabled={!near} onClick={() => performForageAction(selectedForage as number)}>
            채집
          </button>
        </div>
      );
    }

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

  const nearbyTarget = nearbyInteraction?.target;

  if (nearbyTarget?.kind === "decoration") {
    const decoration = game.decorations.find((item) => item.id === nearbyTarget.id);
    if (decoration) {
      const def = DECOR_DEFS[decoration.type];
      return (
        <div className="plot-details">
          <p className="detail-copy">
            {def.name} · 아늑함 {def.cozy} · 설치된 장식
          </p>
          <button className="primary-button secondary" type="button" onClick={() => pickupDecoration(decoration.id)}>
            회수
          </button>
        </div>
      );
    }
  }

  if (nearbyTarget?.kind === "compost") {
    const wiltedKey = findWiltedInventoryKey(game);
    const emptySlot = game.compost.slots.some((slot) => slot === null);
    return (
      <div className="plot-details plot-details--compost">
        <div className="detail-copy">
          <strong>퇴비함</strong>
          <div className="compost-slots">
            {game.compost.slots.map((slot, index) => {
              const remaining = getCompostRemainingMs(slot, now);
              const label = !slot ? "비어 있음" : remaining <= 0 ? "완성" : `${formatDuration(remaining)} 남음`;
              return (
                <span className="compost-slot" key={index}>
                  슬롯 {index + 1}: {label}
                </span>
              );
            })}
          </div>
          {!wiltedKey && <small>넣을 시든 작물이 없습니다.</small>}
        </div>
        {game.compost.slots.map((slot, index) => (
          <button
            className="primary-button"
            type="button"
            key={index}
            disabled={!slot || getCompostRemainingMs(slot, now) > 0}
            onClick={() => collectCompost(index)}
          >
            슬롯 {index + 1} 수거
          </button>
        ))}
        <button className="primary-button secondary" type="button" disabled={!emptySlot || !wiltedKey} onClick={addWiltedToCompost}>
          시든 작물 넣기
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
    const near = isPlotNear(index);
    return (
      <div className="plot-details">
        <p className="detail-copy">잠긴 밭 · 확장 비용 {unlockCost}G{!near ? " · 가까이 가야 합니다" : ""}</p>
        <button className="primary-button" type="button" disabled={!near || game.gold < unlockCost} onClick={() => performPlotAction(index)}>
          확장
        </button>
      </div>
    );
  }

  if (!plot.crop) {
    const crop = CROP_DEFS[game.selectedSeed];
    const count = game.seeds[crop.id] || 0;
    const near = isPlotNear(index);
    return (
      <div className="plot-details">
        <p className="detail-copy">
          {crop.name} · 성장 {formatDuration(crop.growMs)} · 기본 판매가 {crop.sellPrice}G · 보유 {count}개
          {!near ? " · 가까이 가야 합니다" : ""}
        </p>
        <button className="primary-button" type="button" disabled={!near || count <= 0} onClick={() => performPlotAction(index)}>
          심기
        </button>
      </div>
    );
  }

  const status = getCropStatus(plot, now);
  const near = isPlotNear(index);
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
        {!near ? " · 가까이 가야 합니다" : ""}
      </p>
      {status.isReady ? (
        <button className="primary-button" type="button" disabled={!near} onClick={() => performPlotAction(index)}>
          수확
        </button>
      ) : (
        <>
          <button className="primary-button secondary" type="button" disabled={!near || plot.crop.watered} onClick={() => performPlotAction(index)}>
            물주기
          </button>
          <button className="primary-button warning" type="button" disabled={!near || game.goldenWater <= 0} onClick={() => useGoldenWater(index)}>
            황금 물뿌리개
          </button>
          <button className="primary-button" type="button" disabled={!near || game.fertilizer <= 0 || plot.crop.fertilized} onClick={() => useFertilizer(index)}>
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
  const bonus = getVisitorBonus(game);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{visitor.name}의 요청</h2>
        <span className="soft-badge">{visitor.done ? "완료" : `x${bonus}`}</span>
      </div>
      <div className="visitor-card">
        <p>{crop.name} 수확물을 {bonus}배 가격으로 정산합니다. 아늑함이 높을수록 손님 보너스가 올라갑니다.</p>
        <button className="primary-button" type="button" disabled={visitor.done || !hasCrop} onClick={deliverVisitorOrder}>
          {visitor.done ? "요청 완료" : `${crop.name} 납품`}
        </button>
      </div>
      <div className="affinity-list">
        {VISITORS.map((name) => {
          const value = game.visitorAffinity[name] || 0;
          return (
            <span className="affinity-chip" key={name}>
              {name} {value}/15
            </span>
          );
        })}
      </div>
    </section>
  );
}

function PetsPanel() {
  const game = useGameStore((store) => store.game);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>정착한 친구</h2>
        <span className="soft-badge">{game.pets.length}마리</span>
      </div>
      {game.pets.length === 0 ? (
        <p className="empty-state">호감도 15에 도달하면 손님의 동물 친구가 정원에 머뭅니다.</p>
      ) : (
        <div className="stack-list">
          {game.pets.map((petId) => {
            const pet = PET_DEFS[petId];
            return (
              <div className="list-row" key={petId}>
                <div>
                  <strong>{pet.name}</strong>
                  <small>{pet.helper === "water" ? "하루 한 번 물주기 도움" : "하루 한 번 채집물 선물"}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ShopPanel() {
  const game = useGameStore((store) => store.game);
  const buySeed = useGameStore((store) => store.buySeed);
  const buyDecoration = useGameStore((store) => store.buyDecoration);
  const startDecorationPlacement = useGameStore((store) => store.startDecorationPlacement);
  const count = getCodexCount(game);
  const unplacedDecorations = game.decorations.filter((decoration) => !isDecorationPlaced(decoration));

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>상점</h2>
        <span className="soft-badge">{BALANCE_LABEL}</span>
      </div>
      <h3 className="shop-subheading">씨앗</h3>
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
      <h3 className="shop-subheading">장식</h3>
      <div className="stack-list">
        {Object.values(DECOR_DEFS).map((decor) => (
          <div className="list-row" key={decor.id}>
            <div>
              <strong>{decor.name}</strong>
              <small>아늑함 {decor.cozy}</small>
            </div>
            <div className="row-actions">
              <button className="item-button" type="button" disabled={game.gold < decor.cost} onClick={() => buyDecoration(decor.id)}>
                {decor.cost}G
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="owned-decor-list">
        <strong>보유 장식</strong>
        {unplacedDecorations.length === 0 ? (
          <small>미배치 장식 없음</small>
        ) : (
          <div className="stack-list">
            {unplacedDecorations.map((decoration) => (
              <div className="list-row" key={decoration.id}>
                <div>
                  <strong>{DECOR_DEFS[decoration.type].name}</strong>
                  <small>아늑함 {DECOR_DEFS[decoration.type].cozy}</small>
                </div>
                <div className="row-actions">
                  <button className="item-button secondary" type="button" onClick={() => startDecorationPlacement(decoration.id)}>
                    배치
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
  const sections = [
    { title: "작물", entries: possible.filter((entry) => entry.key.startsWith("crop|")) },
    { title: "채집", entries: possible.filter((entry) => entry.key.startsWith("forage|")) },
    { title: "생물", entries: possible.filter((entry) => entry.key.startsWith("critter|")) },
    { title: "물고기", entries: possible.filter((entry) => entry.key.startsWith("fish|")) },
  ];

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>도감</h2>
        <span className="soft-badge">{count}/{possible.length}</span>
      </div>
      {sections.map((section) => (
        <div className="codex-section" key={section.title}>
          <h3 className="codex-section-title">{section.title}</h3>
          <div className="codex-grid">
            {section.entries.map((entry) => {
              const found = Boolean(game.codex[entry.key]);
              return (
                <div className={`codex-tile ${found ? "is-found" : ""}`} key={entry.key}>
                  {found ? entry.label : "???"}
                </div>
              );
            })}
          </div>
        </div>
      ))}
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
  const season = getSeason(now);
  const weather = getWeather(now);
  const compostReady = game.compost.slots.filter((slot) => slot && getCompostRemainingMs(slot, now) <= 0).length;

  return (
    <ul className="sr-only">
      <li>
        정원 상태: {getSeasonName(season)}, {getWeatherName(weather)}, 아늑함 {getCoziness(game)}, 완성 퇴비 {compostReady}개, 미끼 {game.bait}개, 정착한 친구 {game.pets.length}마리
      </li>
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

function InteractionPromptOverlay() {
  const prompt = useGameStore((store) => store.nearbyInteraction);
  if (!prompt) return null;

  return (
    <div className="interaction-prompt" aria-live="polite">
      <kbd>E</kbd>
      <span>{prompt.label}</span>
    </div>
  );
}

function TouchControls() {
  const prompt = useGameStore((store) => store.nearbyInteraction);
  const placementDecorationId = useGameStore((store) => store.placementDecorationId);
  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const maxRadius = 46;

  const updateMove = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = clientX - centerX;
    const rawY = clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > maxRadius ? maxRadius / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    setKnob({ x, y, active: true });
    setVirtualMove(x / maxRadius, y / maxRadius);
  };

  const stopMove = () => {
    setKnob({ x: 0, y: 0, active: false });
    setVirtualMove(0, 0);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateMove(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!knob.active) return;
    updateMove(event.clientX, event.clientY);
  };

  return (
    <div className="touch-controls" aria-label="모바일 조작">
      <div
        ref={padRef}
        className="touch-joystick"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopMove}
        onPointerCancel={stopMove}
      >
        <span className="touch-joystick__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <button className="touch-action-button" type="button" disabled={!prompt && !placementDecorationId} onClick={requestVirtualInteraction}>
        {placementDecorationId ? "설치" : prompt ? prompt.label : "대상 없음"}
      </button>
    </div>
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
        <InteractionPromptOverlay />
      </section>
      <SeedBar />
      <PlotDetails />
      <HiddenPlotStatus />
      <TouchControls />
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
          <span>비 소식 <strong>{summary.weatherNotice}</strong></span>
          <span>생물 흔적 <strong>{summary.critterTrace || "없음"}</strong></span>
          <span>퇴비 완성 <strong>{summary.compostReadyCount}개</strong></span>
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
          <PetsPanel />
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
