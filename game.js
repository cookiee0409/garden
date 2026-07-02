(() => {
  const SAVE_KEY = "mini-idle-garden-save-v1";
  const OFFLINE_GROWTH_CAP_MS = 12 * 60 * 60 * 1000;
  const WILT_AFTER_MS = 45 * 60 * 1000;
  const GATHER_REFILL_MS = 5 * 60 * 1000;

  const CROP_DEFS = {
    tomato: {
      id: "tomato",
      name: "방울토마토",
      seedCost: 10,
      sellPrice: 25,
      growMs: 45 * 1000,
      className: "tomato",
      tier: 1,
      note: "가볍게 돌리는 첫 작물",
    },
    carrot: {
      id: "carrot",
      name: "당근",
      seedCost: 14,
      sellPrice: 34,
      growMs: 75 * 1000,
      className: "carrot",
      tier: 1,
      note: "초반 골드 벌이용",
    },
    strawberry: {
      id: "strawberry",
      name: "딸기",
      seedCost: 50,
      sellPrice: 140,
      growMs: 4 * 60 * 1000,
      className: "strawberry",
      tier: 2,
      note: "하루 두 번 접속 리듬의 중심",
    },
    sunflower: {
      id: "sunflower",
      name: "해바라기",
      seedCost: 70,
      sellPrice: 190,
      growMs: 6 * 60 * 1000,
      className: "sunflower",
      tier: 2,
      note: "조금 더 긴 호흡의 수익 작물",
    },
    watermelon: {
      id: "watermelon",
      name: "수박",
      seedCost: 200,
      sellPrice: 600,
      growMs: 10 * 60 * 1000,
      className: "watermelon",
      tier: 3,
      unlockCodex: 6,
      note: "도감 6칸 달성 후 판매",
    },
  };

  const QUALITY_DEFS = {
    normal: { id: "normal", name: "일반", multiplier: 1, className: "quality-normal" },
    silver: { id: "silver", name: "은빛", multiplier: 1.55, className: "quality-silver" },
    gold: { id: "gold", name: "황금", multiplier: 2.8, className: "quality-gold" },
    wilted: { id: "wilted", name: "시든", multiplier: 0.6, className: "quality-wilted" },
  };

  const FORAGE_DEFS = {
    mushroom: { id: "mushroom", name: "작은 버섯", sellPrice: 18, symbol: "버", weight: 32 },
    berry: { id: "berry", name: "숲 열매", sellPrice: 22, symbol: "열", weight: 28 },
    wildflower: { id: "wildflower", name: "들꽃", sellPrice: 16, symbol: "꽃", weight: 28 },
    clover: { id: "clover", name: "네잎클로버", sellPrice: 45, symbol: "클", weight: 8 },
    firefly: { id: "firefly", name: "밤빛 조각", sellPrice: 64, symbol: "밤", weight: 4, nightOnly: true },
  };

  const PLOT_UNLOCK_COSTS = [0, 0, 0, 0, 120, 170, 240, 330, 460];
  const VISITORS = ["루나", "솔", "마루", "노아", "아라"];
  const FORAGE_POSITIONS = [
    { x: 19, y: 22 },
    { x: 42, y: 18 },
    { x: 66, y: 26 },
    { x: 27, y: 54 },
    { x: 54, y: 58 },
    { x: 75, y: 51 },
  ];
  const CODEX_REWARDS = [
    { id: "3", required: 3, title: "새싹 연구 보상", description: "방울토마토 씨앗 2개와 딸기 씨앗 1개" },
    { id: "6", required: 6, title: "정원 기록 보상", description: "골드 140과 황금 물뿌리개 1회" },
    { id: "10", required: 10, title: "수집가 보상", description: "수박 씨앗 1개와 골드 220" },
  ];

  let state = initializeState();
  let renderTimer = null;

  document.addEventListener("click", handleClick);
  boot();

  function boot() {
    const messages = [];
    const now = Date.now();
    applyOfflineGrowthCap(now);
    messages.push(...applyDailyLogin());
    if (applyGatherRefill(now)) {
      messages.push("숲 입구 채집 기회가 다시 채워졌습니다.");
    }
    ensureDailyVisitor();
    saveState();
    render();
    renderTimer = window.setInterval(render, 1000);
    messages.forEach((message) => showToast(message));
  }

  function applyOfflineGrowthCap(now) {
    const lastSeenAt = typeof state.lastSeenAt === "number" ? state.lastSeenAt : now;
    const offlineElapsed = Math.max(0, now - lastSeenAt);
    const cappedOutMs = Math.max(0, offlineElapsed - OFFLINE_GROWTH_CAP_MS);
    if (cappedOutMs <= 0) return false;

    state.plots.forEach((plot) => {
      if (plot.crop) plot.crop.plantedAt += cappedOutMs;
    });
    return true;
  }

  function initializeState() {
    const saved = readSave();
    const base = createDefaultState();
    if (!saved) return base;

    const merged = {
      ...base,
      ...saved,
      seeds: { ...base.seeds, ...(saved.seeds || {}) },
      inventory: { ...(saved.inventory || {}) },
      codex: { ...(saved.codex || {}) },
      claimedRewards: Array.isArray(saved.claimedRewards) ? saved.claimedRewards : [],
      plots: base.plots.map((plot, index) => ({
        ...plot,
        ...((saved.plots || [])[index] || {}),
      })),
      gather: {
        ...base.gather,
        ...(saved.gather || {}),
      },
    };

    merged.plots = merged.plots.map((plot, index) => ({
      id: index,
      unlocked: Boolean(plot.unlocked),
      crop: sanitizeCrop(plot.crop),
    }));

    if (!CROP_DEFS[merged.selectedSeed]) merged.selectedSeed = "tomato";
    if (!["garden", "forest"].includes(merged.scene)) merged.scene = "garden";
    if (!Array.isArray(merged.gather.spots)) merged.gather.spots = makeGatherSpots(Date.now());
    if (typeof merged.gather.charges !== "number") merged.gather.charges = 0;
    if (typeof merged.gather.lastRefillAt !== "number") merged.gather.lastRefillAt = Date.now();
    if (typeof merged.gold !== "number") merged.gold = base.gold;
    if (typeof merged.goldenWater !== "number") merged.goldenWater = 0;
    if (typeof merged.streak !== "number") merged.streak = 0;

    return merged;
  }

  function createDefaultState() {
    const now = Date.now();
    return {
      version: 1,
      gold: 120,
      selectedSeed: "tomato",
      selectedPlot: null,
      scene: "garden",
      seeds: {
        tomato: 4,
        carrot: 2,
        strawberry: 0,
        sunflower: 0,
        watermelon: 0,
      },
      plots: Array.from({ length: 9 }, (_, index) => ({
        id: index,
        unlocked: index < 4,
        crop: null,
      })),
      inventory: {},
      codex: {},
      claimedRewards: [],
      streak: 0,
      lastLoginDate: null,
      goldenWater: 0,
      gather: {
        lastRefillAt: now,
        charges: 0,
        spots: makeGatherSpots(now),
      },
      dailyVisitor: null,
      createdAt: now,
      lastSeenAt: now,
    };
  }

  function sanitizeCrop(crop) {
    if (!crop || !CROP_DEFS[crop.type]) return null;
    const now = Date.now();
    const plantedAt = typeof crop.plantedAt === "number" ? crop.plantedAt : now;
    return {
      type: crop.type,
      plantedAt: Math.min(plantedAt, now),
      boostMs: typeof crop.boostMs === "number" ? crop.boostMs : 0,
      watered: Boolean(crop.watered),
    };
  }

  function readSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Save data could not be read.", error);
      return null;
    }
  }

  function saveState() {
    try {
      state.lastSeenAt = Date.now();
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Save data could not be written.", error);
    }
  }

  function applyDailyLogin() {
    const today = getDayKey(Date.now());
    if (state.lastLoginDate === today) return [];

    const previous = state.lastLoginDate;
    const wasYesterday = previous && getDayIndex(today) - getDayIndex(previous) === 1;
    state.streak = wasYesterday ? state.streak + 1 : 1;
    state.lastLoginDate = today;
    state.goldenWater = Math.min(3, state.goldenWater + 1);

    return [
      `오늘의 첫 접속 보상으로 황금 물뿌리개 1회를 받았습니다. 연속 출석 ${state.streak}일째입니다.`,
    ];
  }

  function ensureDailyVisitor() {
    const today = getDayKey(Date.now());
    if (state.dailyVisitor && state.dailyVisitor.date === today) {
      if (state.dailyVisitor.bonus === 1.5) return false;
      state.dailyVisitor.bonus = 1.5;
      return true;
    }

    const availableCrops = Object.keys(CROP_DEFS).filter((cropId) => {
      const crop = CROP_DEFS[cropId];
      return !crop.unlockCodex || getCodexCount() >= crop.unlockCodex;
    });
    const cropType = availableCrops[hashString(today) % availableCrops.length];
    const visitorName = VISITORS[hashString(`${today}:visitor`) % VISITORS.length];

    state.dailyVisitor = {
      date: today,
      name: visitorName,
      cropType,
      bonus: 1.5,
      done: false,
    };
    return true;
  }

  function applyGatherRefill(now) {
    let changed = false;
    if (!state.gather) {
      state.gather = { lastRefillAt: now, charges: 0, spots: makeGatherSpots(now) };
      return true;
    }

    if (state.gather.lastRefillAt > now) {
      state.gather.lastRefillAt = now;
      changed = true;
    }

    const elapsed = now - state.gather.lastRefillAt;
    const refillCount = Math.floor(elapsed / GATHER_REFILL_MS);
    if (refillCount > 0) {
      state.gather.charges = Math.min(2, state.gather.charges + refillCount);
      state.gather.lastRefillAt += refillCount * GATHER_REFILL_MS;
      changed = true;
    }

    return changed;
  }

  function handleClick(event) {
    const control = event.target.closest("[data-action]");
    if (!control || control.disabled) return;

    const action = control.dataset.action;
    if (action === "switch-scene") switchScene(control.dataset.scene);
    if (action === "select-seed") selectSeed(control.dataset.crop);
    if (action === "buy-seed") buySeed(control.dataset.crop);
    if (action === "plot-click") handlePlotClick(Number(control.dataset.index));
    if (action === "plant-selected") plantCrop(Number(control.dataset.index));
    if (action === "unlock-plot") unlockPlot(Number(control.dataset.index));
    if (action === "use-water") useGoldenWater(Number(control.dataset.index));
    if (action === "harvest-plot") harvestPlot(Number(control.dataset.index));
    if (action === "sell-item") sellItem(control.dataset.key);
    if (action === "sell-all") sellAll();
    if (action === "deliver-visitor") deliverVisitorOrder();
    if (action === "collect-forage") collectForage(Number(control.dataset.index));
    if (action === "start-gather-round") startGatherRound();
    if (action === "claim-reward") claimReward(control.dataset.reward);
    if (action === "reset-game") resetGame();
  }

  function switchScene(scene) {
    if (!["garden", "forest"].includes(scene)) return;
    state.scene = scene;
    saveState();
    render();
  }

  function selectSeed(cropId) {
    if (!CROP_DEFS[cropId]) return;
    state.selectedSeed = cropId;
    saveState();
    render();
  }

  function buySeed(cropId) {
    const crop = CROP_DEFS[cropId];
    if (!crop) return;
    if (crop.unlockCodex && getCodexCount() < crop.unlockCodex) {
      showToast(`도감 ${crop.unlockCodex}칸을 채우면 ${crop.name} 씨앗이 열립니다.`);
      return;
    }
    if (state.gold < crop.seedCost) {
      showToast("골드가 부족합니다. 수확물이나 채집물을 판매해 보세요.");
      return;
    }

    state.gold -= crop.seedCost;
    state.seeds[cropId] = (state.seeds[cropId] || 0) + 1;
    state.selectedSeed = cropId;
    showToast(`${crop.name} 씨앗을 1개 샀습니다.`);
    saveState();
    render();
  }

  function handlePlotClick(index) {
    const plot = state.plots[index];
    if (!plot) return;

    state.selectedPlot = index;
    if (!plot.unlocked) {
      saveState();
      render();
      return;
    }

    if (!plot.crop) {
      plantCrop(index);
      return;
    }

    const status = getCropStatus(plot, Date.now());
    if (status.isReady) {
      harvestPlot(index);
      return;
    }

    showToast(`${status.def.name}이 자라는 중입니다. 남은 시간은 ${formatDuration(status.remaining)}입니다.`);
    saveState();
    render();
  }

  function plantCrop(index) {
    const plot = state.plots[index];
    const crop = CROP_DEFS[state.selectedSeed];
    if (!plot || !plot.unlocked || !crop) return;
    if (plot.crop) {
      showToast("이미 작물이 자라고 있는 밭입니다.");
      return;
    }
    if ((state.seeds[crop.id] || 0) <= 0) {
      showToast(`${crop.name} 씨앗이 없습니다. 상점에서 씨앗을 사 주세요.`);
      saveState();
      render();
      return;
    }

    state.seeds[crop.id] -= 1;
    plot.crop = {
      type: crop.id,
      plantedAt: Date.now(),
      boostMs: 0,
      watered: false,
    };
    state.selectedPlot = index;
    showToast(`${crop.name}을 심었습니다.`);
    saveState();
    render();
  }

  function unlockPlot(index) {
    const plot = state.plots[index];
    if (!plot || plot.unlocked) return;

    const cost = PLOT_UNLOCK_COSTS[index] || 0;
    if (state.gold < cost) {
      showToast(`밭을 열려면 ${cost}G가 필요합니다.`);
      return;
    }

    state.gold -= cost;
    plot.unlocked = true;
    state.selectedPlot = index;
    showToast("새 밭을 열었습니다.");
    saveState();
    render();
  }

  function useGoldenWater(index) {
    const plot = state.plots[index];
    if (!plot || !plot.crop) return;
    const status = getCropStatus(plot, Date.now());
    if (status.isReady) {
      showToast("이미 다 자란 작물입니다.");
      return;
    }
    if (state.goldenWater <= 0) {
      showToast("오늘 사용할 황금 물뿌리개가 없습니다.");
      return;
    }

    const boost = Math.max(15 * 1000, Math.floor(status.def.growMs * 0.35));
    plot.crop.boostMs = Math.min(status.def.growMs, (plot.crop.boostMs || 0) + boost);
    plot.crop.watered = true;
    state.goldenWater -= 1;
    showToast(`${status.def.name}의 성장 시간이 줄고 좋은 품질 확률이 올랐습니다.`);
    saveState();
    render();
  }

  function harvestPlot(index) {
    const plot = state.plots[index];
    if (!plot || !plot.crop) return;
    const status = getCropStatus(plot, Date.now());
    if (!status.isReady) {
      showToast(`아직 ${formatDuration(status.remaining)} 더 기다려야 합니다.`);
      return;
    }

    const quality = status.wilted ? "wilted" : rollQuality(Boolean(plot.crop.watered));
    const key = makeItemKey("crop", plot.crop.type, quality);
    addInventory(key, 1);
    addCodex(key);
    plot.crop = null;
    state.selectedPlot = index;

    const qualityName = QUALITY_DEFS[quality].name;
    showToast(`${status.def.name} ${qualityName} 품질을 수확했습니다.`);
    saveState();
    render();
  }

  function sellItem(key) {
    const quantity = state.inventory[key] || 0;
    if (quantity <= 0) return;

    const item = getItemInfo(key);
    state.inventory[key] -= 1;
    if (state.inventory[key] <= 0) delete state.inventory[key];
    state.gold += item.sellPrice;
    showToast(`${item.name}을 판매하고 ${item.sellPrice}G를 받았습니다.`);
    saveState();
    render();
  }

  function sellAll() {
    const entries = Object.entries(state.inventory).filter(([, quantity]) => quantity > 0);
    if (entries.length === 0) {
      showToast("판매할 아이템이 없습니다.");
      return;
    }

    const total = entries.reduce((sum, [key, quantity]) => sum + getItemInfo(key).sellPrice * quantity, 0);
    state.inventory = {};
    state.gold += total;
    showToast(`인벤토리를 정리하고 ${total}G를 받았습니다.`);
    saveState();
    render();
  }

  function deliverVisitorOrder() {
    const visitor = state.dailyVisitor;
    if (!visitor || visitor.done) return;

    const key = findInventoryCropKey(visitor.cropType);
    if (!key) {
      showToast(`${CROP_DEFS[visitor.cropType].name} 수확물이 필요합니다.`);
      return;
    }

    const item = getItemInfo(key);
    const reward = Math.round(item.sellPrice * visitor.bonus);
    state.inventory[key] -= 1;
    if (state.inventory[key] <= 0) delete state.inventory[key];
    state.gold += reward;
    visitor.done = true;
    showToast(`${visitor.name}의 요청을 완료하고 ${reward}G를 받았습니다.`);
    saveState();
    render();
  }

  function collectForage(index) {
    const spot = state.gather.spots[index];
    if (!spot || spot.collected) return;

    spot.collected = true;
    const key = makeItemKey("forage", spot.item, "normal");
    addInventory(key, 1);
    addCodex(key);
    showToast(`${FORAGE_DEFS[spot.item].name}을 주웠습니다.`);
    saveState();
    render();
  }

  function startGatherRound() {
    if (state.gather.charges <= 0) {
      showToast(`다음 채집 리필까지 ${formatDuration(getGatherRemainingMs(Date.now()))} 남았습니다.`);
      return;
    }

    state.gather.charges -= 1;
    state.gather.spots = makeGatherSpots(Date.now());
    showToast("새 채집 포인트가 반짝이기 시작했습니다.");
    saveState();
    render();
  }

  function claimReward(rewardId) {
    const reward = CODEX_REWARDS.find((item) => item.id === rewardId);
    if (!reward || state.claimedRewards.includes(rewardId) || getCodexCount() < reward.required) return;

    if (rewardId === "3") {
      state.seeds.tomato += 2;
      state.seeds.strawberry += 1;
    }
    if (rewardId === "6") {
      state.gold += 140;
      state.goldenWater = Math.min(3, state.goldenWater + 1);
    }
    if (rewardId === "10") {
      state.seeds.watermelon += 1;
      state.gold += 220;
    }

    state.claimedRewards.push(rewardId);
    showToast(`${reward.title}을 받았습니다.`);
    saveState();
    render();
  }

  function resetGame() {
    const confirmed = window.confirm("현재 저장된 정원을 지우고 처음부터 시작할까요?");
    if (!confirmed) return;

    window.clearInterval(renderTimer);
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch (error) {
      console.warn("Save data could not be cleared.", error);
    }
    state = createDefaultState();
    boot();
    showToast("새 정원을 시작했습니다.");
  }

  function render() {
    const now = Date.now();
    if (applyGatherRefill(now)) saveState();
    if (ensureDailyVisitor()) saveState();

    renderResources();
    renderScene();
    renderSeeds();
    renderPlots(now);
    renderPlotDetails(now);
    renderVisitor();
    renderShop();
    renderInventory();
    renderCodex();
  }

  function renderResources() {
    const unlocked = state.plots.filter((plot) => plot.unlocked).length;
    const seedCount = Object.values(state.seeds).reduce((sum, value) => sum + value, 0);
    const cropCount = state.plots.filter((plot) => plot.crop).length;

    $("resource-strip").innerHTML = [
      resourcePill("골드", `${state.gold}G`),
      resourcePill("씨앗", `${seedCount}개`),
      resourcePill("밭", `${unlocked}/9`),
      resourcePill("재배", `${cropCount}칸`),
      resourcePill("출석", `${state.streak}일`),
      resourcePill("물뿌리개", `${state.goldenWater}회`),
    ].join("");
  }

  function renderScene() {
    const scene = $("scene");
    scene.classList.toggle("scene--garden", state.scene === "garden");
    scene.classList.toggle("scene--forest", state.scene === "forest");

    document.querySelectorAll(".tab-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.scene === state.scene);
    });

    renderForest();
  }

  function renderSeeds() {
    const seedHtml = Object.values(CROP_DEFS)
      .map((crop) => {
        const count = state.seeds[crop.id] || 0;
        const active = state.selectedSeed === crop.id;
        return `
          <button
            class="seed-chip ${active ? "active" : ""}"
            type="button"
            data-action="select-seed"
            data-crop="${crop.id}"
            aria-pressed="${active}"
          >
            <span class="seed-dot ${crop.className}"></span>
            <span>${crop.name}</span>
            <span class="muted">${count}개</span>
          </button>
        `;
      })
      .join("");
    $("seed-bar").innerHTML = seedHtml;
  }

  function renderPlots(now) {
    const html = state.plots
      .map((plot, index) => {
        const selected = state.selectedPlot === index;
        if (!plot.unlocked) {
          return `
            <button class="plot is-locked ${selected ? "is-selected" : ""}" type="button" data-action="plot-click" data-index="${index}" aria-label="잠긴 밭 ${index + 1}">
              <span class="lock-mark">${PLOT_UNLOCK_COSTS[index]}G</span>
            </button>
          `;
        }

        if (!plot.crop) {
          return `
            <button class="plot ${selected ? "is-selected" : ""}" type="button" data-action="plot-click" data-index="${index}" aria-label="빈 밭 ${index + 1}">
              <span class="plot-label">빈 밭</span>
            </button>
          `;
        }

        const status = getCropStatus(plot, now);
        const classes = [
          "plot",
          selected ? "is-selected" : "",
          status.isReady ? "is-ready" : "",
          status.wilted ? "is-wilted" : "",
        ].join(" ");
        return `
          <button class="${classes}" type="button" data-action="plot-click" data-index="${index}" aria-label="${status.def.name} 밭 ${index + 1}">
            ${renderCropObject(status)}
            ${status.isReady ? '<span class="sparkle"></span>' : ""}
            <span class="plot-label">${status.wilted ? "시듦" : status.isReady ? "수확" : formatDuration(status.remaining)}</span>
            ${
              status.isReady
                ? ""
                : `<span class="plot-progress"><span style="width: ${Math.round(status.progress * 100)}%"></span></span>`
            }
          </button>
        `;
      })
      .join("");

    $("plot-grid").innerHTML = html;
  }

  function renderCropObject(status) {
    const cropClass = `crop--${status.def.className}`;
    const stageClass = status.stage === "sprout" ? "crop--sprout" : status.stage === "middle" ? "crop--middle" : "crop--ready";
    const multiFruitCrops = ["tomato", "strawberry"];
    const matureFruitCount = multiFruitCrops.includes(status.def.id) ? 3 : 1;
    const middleFruitCount = multiFruitCrops.includes(status.def.id) ? 1 : 0;
    const fruitCount = status.stage === "sprout" ? 0 : status.stage === "middle" ? middleFruitCount : matureFruitCount;
    const fruits = Array.from({ length: fruitCount }, (_, index) => {
      const names = ["fruit--one", "fruit--two", "fruit--three"];
      return `<span class="crop__fruit ${names[index] || ""}"></span>`;
    }).join("");

    return `
      <span class="crop ${cropClass} ${stageClass}">
        <span class="crop__leaf"></span>
        ${fruits}
      </span>
    `;
  }

  function renderPlotDetails(now) {
    const panel = $("plot-details");

    if (state.scene === "forest") {
      const allCollected = state.gather.spots.every((spot) => spot.collected);
      panel.innerHTML = `
        <p class="detail-copy">
          채집 포인트는 데모에서 5분마다 리필되고 최대 2회까지 보관됩니다.
          현재 예비 리필은 ${state.gather.charges}회, 다음 리필까지 ${formatDuration(getGatherRemainingMs(now))}입니다.
        </p>
        <button class="primary-button secondary" type="button" data-action="start-gather-round" ${!allCollected || state.gather.charges <= 0 ? "disabled" : ""}>
          새 포인트 펼치기
        </button>
      `;
      return;
    }

    const index = state.selectedPlot;
    const plot = Number.isInteger(index) ? state.plots[index] : null;
    if (!plot) {
      panel.innerHTML = `
        <p class="detail-copy">
          아래 씨앗을 고른 뒤 빈 밭을 누르면 바로 심습니다. 다 자란 작물을 누르면 수확하고, 결과는 인벤토리에 들어갑니다.
        </p>
      `;
      return;
    }

    if (!plot.unlocked) {
      const cost = PLOT_UNLOCK_COSTS[index] || 0;
      panel.innerHTML = `
        <p class="detail-copy">잠긴 밭입니다. ${cost}G를 사용하면 새 재배 칸으로 확장됩니다.</p>
        <button class="primary-button" type="button" data-action="unlock-plot" data-index="${index}" ${state.gold < cost ? "disabled" : ""}>
          ${cost}G로 확장
        </button>
      `;
      return;
    }

    if (!plot.crop) {
      const crop = CROP_DEFS[state.selectedSeed];
      const count = state.seeds[crop.id] || 0;
      panel.innerHTML = `
        <p class="detail-copy">
          선택한 씨앗은 ${crop.name}입니다. 성장 시간 ${formatDuration(crop.growMs)}, 기본 판매가 ${crop.sellPrice}G.
          보유 씨앗은 ${count}개입니다.
        </p>
        <button class="primary-button" type="button" data-action="plant-selected" data-index="${index}" ${count <= 0 ? "disabled" : ""}>
          이 밭에 심기
        </button>
      `;
      return;
    }

    const status = getCropStatus(plot, now);
    panel.innerHTML = `
      <p class="detail-copy">
        ${status.def.name}이 ${Math.round(status.progress * 100)}% 자랐습니다.
        ${
          status.isReady
            ? status.wilted
              ? "오래 방치되어 시든 품질로 수확됩니다."
              : "지금 수확할 수 있습니다."
            : `남은 시간은 ${formatDuration(status.remaining)}입니다.`
        }
      </p>
      ${
        status.isReady
          ? `<button class="primary-button" type="button" data-action="harvest-plot" data-index="${index}">수확하기</button>`
          : `<button class="primary-button warning" type="button" data-action="use-water" data-index="${index}" ${state.goldenWater <= 0 ? "disabled" : ""}>황금 물뿌리개 사용</button>`
      }
    `;
  }

  function renderForest() {
    const layer = $("forest-layer");
    const spots = state.gather.spots || [];
    const allCollected = spots.every((spot) => spot.collected);

    const spotHtml = spots
      .map((spot, index) => {
        const item = FORAGE_DEFS[spot.item];
        const position = FORAGE_POSITIONS[index % FORAGE_POSITIONS.length];
        return `
          <button
            class="forage-spot ${spot.collected ? "is-collected" : ""}"
            type="button"
            data-action="collect-forage"
            data-index="${index}"
            style="left: ${position.x}%; top: ${position.y}%;"
            aria-label="${item.name}"
            ${spot.collected ? "disabled" : ""}
          >
            ${spot.collected ? "·" : item.symbol}
          </button>
        `;
      })
      .join("");

    const emptyHtml = allCollected
      ? `
        <div class="forest-empty">
          <h3>채집 완료</h3>
          <p class="empty-state">예비 리필 ${state.gather.charges}회 · 다음 리필 ${formatDuration(getGatherRemainingMs(Date.now()))}</p>
          <button class="primary-button secondary" type="button" data-action="start-gather-round" ${state.gather.charges <= 0 ? "disabled" : ""}>
            새 포인트 펼치기
          </button>
        </div>
      `
      : "";

    layer.innerHTML = spotHtml + emptyHtml;
  }

  function renderVisitor() {
    const visitor = state.dailyVisitor;
    if (!visitor) return;

    const crop = CROP_DEFS[visitor.cropType];
    const hasCrop = Boolean(findInventoryCropKey(visitor.cropType));
    $("visitor-badge").textContent = visitor.done ? "완료" : `x${visitor.bonus}`;
    $("daily-visitor").innerHTML = `
      <div class="visitor-card">
        <h3>${visitor.name}의 요청</h3>
        <p>
          오늘은 ${crop.name} 수확물을 웃돈으로 받습니다.
          품질 보너스까지 계산한 뒤 ${visitor.bonus}배 가격으로 정산됩니다.
        </p>
        <button class="primary-button" type="button" data-action="deliver-visitor" ${visitor.done || !hasCrop ? "disabled" : ""}>
          ${visitor.done ? "요청 완료" : `${crop.name} 납품하기`}
        </button>
      </div>
    `;
  }

  function renderShop() {
    const count = getCodexCount();
    $("shop-list").innerHTML = Object.values(CROP_DEFS)
      .map((crop) => {
        const locked = crop.unlockCodex && count < crop.unlockCodex;
        return `
          <div class="list-row">
            <div>
              <strong>${crop.name} 씨앗</strong>
              <small>${crop.note} · ${formatDuration(crop.growMs)} · 판매가 ${crop.sellPrice}G</small>
            </div>
            <div class="row-actions">
              <button class="item-button ${locked ? "secondary" : ""}" type="button" data-action="buy-seed" data-crop="${crop.id}" ${locked || state.gold < crop.seedCost ? "disabled" : ""}>
                ${locked ? `도감 ${crop.unlockCodex}` : `${crop.seedCost}G`}
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderInventory() {
    const entries = Object.entries(state.inventory).filter(([, quantity]) => quantity > 0);
    if (entries.length === 0) {
      $("inventory-list").innerHTML = `<p class="empty-state">아직 보관 중인 수확물이나 채집물이 없습니다.</p>`;
      return;
    }

    $("inventory-list").innerHTML = entries
      .sort(([a], [b]) => getItemInfo(a).name.localeCompare(getItemInfo(b).name, "ko"))
      .map(([key, quantity]) => {
        const item = getItemInfo(key);
        return `
          <div class="list-row">
            <div>
              <strong class="${item.qualityClass}">${item.name} × ${quantity}</strong>
              <small>개당 ${item.sellPrice}G</small>
            </div>
            <div class="row-actions">
              <button class="item-button" type="button" data-action="sell-item" data-key="${key}">
                판매
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderCodex() {
    const possible = getPossibleCodexEntries();
    const count = getCodexCount();
    $("codex-count").textContent = `${count}/${possible.length}`;

    const tiles = possible
      .map((entry) => {
        const found = Boolean(state.codex[entry.key]);
        return `
          <div class="codex-tile ${found ? "is-found" : ""}">
            ${found ? entry.label : "???"}
          </div>
        `;
      })
      .join("");

    const rewards = CODEX_REWARDS.map((reward) => {
      const claimed = state.claimedRewards.includes(reward.id);
      const ready = count >= reward.required && !claimed;
      return `
        <div class="list-row">
          <div>
            <strong>${reward.title}</strong>
            <small>${reward.required}칸 필요 · ${reward.description}</small>
          </div>
          <div class="row-actions">
            <button class="item-button ${claimed ? "secondary" : ""}" type="button" data-action="claim-reward" data-reward="${reward.id}" ${!ready ? "disabled" : ""}>
              ${claimed ? "완료" : "받기"}
            </button>
          </div>
        </div>
      `;
    }).join("");

    $("codex-panel").innerHTML = `
      <div class="codex-grid">${tiles}</div>
      <div class="reward-list">${rewards}</div>
    `;
  }

  function getCropStatus(plot, now) {
    const crop = plot.crop;
    const def = CROP_DEFS[crop.type];
    const boostedElapsed = now - crop.plantedAt + (crop.boostMs || 0);
    const elapsed = Math.max(0, boostedElapsed);
    const progress = clamp(elapsed / def.growMs, 0, 1);
    const remaining = Math.max(0, def.growMs - elapsed);
    const matureAt = crop.plantedAt + Math.max(0, def.growMs - (crop.boostMs || 0));
    const wilted = progress >= 1 && now - matureAt > WILT_AFTER_MS;
    const stage = progress >= 1 ? "ready" : progress >= 0.45 ? "middle" : "sprout";
    return { def, elapsed, progress, remaining, matureAt, wilted, stage, isReady: progress >= 1 };
  }

  function rollQuality(hasWaterBonus) {
    const goldChance = hasWaterBonus ? 0.18 : 0.08;
    const silverChance = hasWaterBonus ? 0.34 : 0.22;
    const roll = Math.random();
    if (roll < goldChance) return "gold";
    if (roll < goldChance + silverChance) return "silver";
    return "normal";
  }

  function makeGatherSpots(now) {
    return FORAGE_POSITIONS.map((_, index) => ({
      id: `${now}-${index}`,
      item: pickForageItem(),
      collected: false,
    }));
  }

  function pickForageItem() {
    const night = isNightTime();
    const pool = Object.values(FORAGE_DEFS).filter((item) => !item.nightOnly || night);
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;

    for (const item of pool) {
      roll -= item.weight;
      if (roll <= 0) return item.id;
    }
    return pool[0].id;
  }

  function isNightTime() {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 5;
  }

  function addInventory(key, amount) {
    state.inventory[key] = (state.inventory[key] || 0) + amount;
  }

  function addCodex(key) {
    if (state.codex[key]) return;
    state.codex[key] = { firstObtainedAt: Date.now() };
  }

  function getItemInfo(key) {
    const { kind, id, quality } = parseItemKey(key);
    if (kind === "crop") {
      const crop = CROP_DEFS[id];
      const qualityDef = QUALITY_DEFS[quality] || QUALITY_DEFS.normal;
      return {
        kind,
        id,
        quality,
        name: `${crop.name} (${qualityDef.name})`,
        sellPrice: Math.round(crop.sellPrice * qualityDef.multiplier),
        qualityClass: qualityDef.className,
      };
    }

    const forage = FORAGE_DEFS[id];
    return {
      kind,
      id,
      quality,
      name: forage.name,
      sellPrice: forage.sellPrice,
      qualityClass: "quality-normal",
    };
  }

  function makeItemKey(kind, id, quality) {
    return `${kind}|${id}|${quality}`;
  }

  function parseItemKey(key) {
    const [kind, id, quality] = key.split("|");
    return { kind, id, quality };
  }

  function findInventoryCropKey(cropType) {
    const priority = ["wilted", "normal", "silver", "gold"];
    for (const quality of priority) {
      const key = makeItemKey("crop", cropType, quality);
      if ((state.inventory[key] || 0) > 0) return key;
    }
    return null;
  }

  function getPossibleCodexEntries() {
    const cropEntries = Object.values(CROP_DEFS).flatMap((crop) =>
      ["normal", "silver", "gold"].map((quality) => ({
        key: makeItemKey("crop", crop.id, quality),
        label: `${crop.name} ${QUALITY_DEFS[quality].name}`,
      })),
    );

    const forageEntries = Object.values(FORAGE_DEFS).map((item) => ({
      key: makeItemKey("forage", item.id, "normal"),
      label: item.name,
    }));

    return [...cropEntries, ...forageEntries];
  }

  function getCodexCount() {
    return getPossibleCodexEntries().filter((entry) => Boolean(state.codex[entry.key])).length;
  }

  function getGatherRemainingMs(now) {
    if (state.gather.charges >= 2) return 0;
    const elapsed = now - state.gather.lastRefillAt;
    return Math.max(0, GATHER_REFILL_MS - (elapsed % GATHER_REFILL_MS));
  }

  function getDayKey(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getDayIndex(key) {
    return Math.floor(new Date(`${key}T00:00:00`).getTime() / 86400000);
  }

  function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function formatDuration(ms) {
    if (ms <= 0) return "완료";
    const totalSeconds = Math.ceil(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}초`;

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`;

    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes > 0 ? `${hours}시간 ${restMinutes}분` : `${hours}시간`;
  }

  function resourcePill(label, value) {
    return `<span class="resource-pill"><span>${label}</span><strong>${value}</strong></span>`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function showToast(message) {
    const stack = $("toast-stack");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    stack.appendChild(toast);
    window.setTimeout(() => {
      toast.remove();
    }, 3600);
  }

  function $(id) {
    return document.getElementById(id);
  }
})();
