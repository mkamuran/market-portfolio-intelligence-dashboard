const state = {
  summary: null,
  news: null,
  events: null,
  eventSort: "priority"
};

const els = {
  metricGrid: document.querySelector("#metricGrid"),
  portfolioGrid: document.querySelector("#portfolioGrid"),
  exposureGrid: document.querySelector("#exposureGrid"),
  focusList: document.querySelector("#focusList"),
  newsList: document.querySelector("#newsList"),
  eventList: document.querySelector("#eventList"),
  holdingForm: document.querySelector("#holdingForm"),
  resetDemo: document.querySelector("#resetDemo"),
  clearHoldingForm: document.querySelector("#clearHoldingForm"),
  asOf: document.querySelector("#asOf"),
  newsStatus: document.querySelector("#newsStatus"),
  toast: document.querySelector("#toast")
};

const TAG_THEME_MAP = {
  金融政策: ["rates", "fx", "growth"],
  金利: ["rates", "growth"],
  物価: ["inflation", "rates", "consumer"],
  雇用: ["growth", "us"],
  景気: ["growth", "cyclical"],
  為替: ["fx", "us"],
  株式: ["equity", "growth"],
  資源: ["energy", "inflation"],
  地政学: ["energy", "defensive"],
  政策: ["policy", "china"],
  中国: ["china", "semiconductor"],
  米国: ["us", "growth"]
};

const EVENT_THEME_MAP = {
  "central-bank": ["rates", "fx", "growth"],
  inflation: ["inflation", "rates", "consumer"],
  employment: ["growth", "us"],
  commodity: ["energy", "inflation"],
  geopolitics: ["energy", "defensive"],
  growth: ["growth", "cyclical"]
};

document.querySelector("#refreshAll").addEventListener("click", () => refreshAll(false));
document.querySelector("#refreshNews").addEventListener("click", () => refreshAll(true));
els.clearHoldingForm.addEventListener("click", clearHoldingForm);
els.resetDemo.addEventListener("click", resetDemoPortfolio);

els.holdingForm.elements.assetType.addEventListener("change", () => {
  const assetType = els.holdingForm.elements.assetType.value;
  els.holdingForm.elements.currency.value = assetType === "stock-us" ? "USD" : "JPY";
});

els.holdingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveHolding(formToObject(els.holdingForm));
});

els.portfolioGrid.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-holding]");
  if (editButton) {
    const holding = allHoldings().find((entry) => entry.id === editButton.dataset.editHolding);
    if (holding) fillHoldingForm(holding);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-holding]");
  if (deleteButton) {
    if (!window.confirm("このサンプル銘柄を削除しますか？")) return;
    await deleteHolding(deleteButton.dataset.deleteHolding);
  }
});

document.querySelectorAll("[data-event-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    state.eventSort = button.dataset.eventSort;
    document
      .querySelectorAll("[data-event-sort]")
      .forEach((entry) => entry.classList.toggle("active", entry === button));
    renderEvents();
    renderFocus();
  });
});

refreshAll(false);
clearHoldingForm();

async function refreshAll(forceNews) {
  setLoading();
  try {
    const [summary, news, events] = await Promise.all([
      api("/api/state"),
      api(`/api/news${forceNews ? "?refresh=1" : ""}`),
      api("/api/events")
    ]);
    state.summary = summary;
    state.news = news;
    state.events = events;
    renderAll();
    toast(forceNews ? "ニュースを再取得しました" : "更新しました");
  } catch (error) {
    toast(error.message || "読み込みに失敗しました");
  }
}

function setLoading() {
  for (const element of [els.metricGrid, els.portfolioGrid, els.exposureGrid, els.focusList, els.newsList, els.eventList]) {
    element.classList.add("loading");
  }
}

function renderAll() {
  renderMetrics();
  renderPortfolios();
  renderExposures();
  renderEvents();
  renderNews();
  renderFocus();
  els.asOf.textContent = state.summary?.asOf ? `更新: ${formatDateTime(state.summary.asOf)}` : "";
}

function renderMetrics() {
  const portfolios = state.summary?.portfolios || [];
  const holdings = allHoldings();
  const totalAssets = portfolios.reduce((sum, portfolio) => sum + portfolio.totalAssetsJPY, 0);
  const pnl = portfolios.reduce((sum, portfolio) => sum + portfolio.effectiveProfitJPY, 0);
  const usdRatio = totalAssets ? exposureBy("currency").find((entry) => entry.key === "USD")?.ratio || 0 : 0;
  const topNews = [...(state.news?.items || [])].sort((a, b) => b.score - a.score)[0];

  els.metricGrid.className = "metric-grid";
  els.metricGrid.innerHTML = [
    metricCard("総評価額", yen(totalAssets), ""),
    metricCard("含み損益", yen(pnl), valueClass(pnl)),
    metricCard("USD比率", pct(usdRatio), usdRatio > 0.35 ? "warning" : ""),
    metricCard("高スコアニュース", topNews ? `${topNews.score} / ${topNews.tags?.[0] || "Market"}` : "なし", "")
  ].join("");

  if (!holdings.length) {
    els.metricGrid.innerHTML += metricCard("保有銘柄", "0件", "");
  }
}

function renderPortfolios() {
  const portfolios = state.summary?.portfolios || [];
  els.portfolioGrid.className = "portfolio-grid";
  if (!portfolios.length) {
    els.portfolioGrid.innerHTML = `<div class="empty">サンプルポートフォリオがありません</div>`;
    return;
  }

  els.portfolioGrid.innerHTML = portfolios.map((portfolio) => {
    const holdings = portfolio.holdings || [];
    return `
      <article class="portfolio-card">
        <header>
          <div>
            <p class="eyebrow">${escapeHtml(portfolio.strategy || "Sample")}</p>
            <h3>${escapeHtml(portfolio.name)}</h3>
          </div>
          <span class="status-pill confirmed">Demo</span>
        </header>
        <div class="portfolio-kpis">
          ${kpi("評価額", yen(portfolio.totalAssetsJPY), "")}
          ${kpi("含み損益", yen(portfolio.effectiveProfitJPY), valueClass(portfolio.effectiveProfitJPY))}
          ${kpi("投下元本", yen(portfolio.investedPrincipalJPY), "")}
          ${kpi("リターン", pct(portfolio.effectiveProfitPercent), valueClass(portfolio.effectiveProfitPercent))}
        </div>
        <div class="table-wrap">
          <table class="holdings">
            <thead>
              <tr>
                <th>銘柄</th>
                <th>テーマ</th>
                <th>評価額</th>
                <th>損益</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${holdings.map(renderHoldingRow).join("")}
            </tbody>
          </table>
        </div>
      </article>
    `;
  }).join("");
}

function renderHoldingRow(holding) {
  const themes = [
    holding.region,
    holding.sector,
    assetTypeLabel(holding.assetType)
  ].filter(Boolean);
  return `
    <tr>
      <td>
        <strong>${escapeHtml(holding.name)}</strong>
        <div class="muted-line">${escapeHtml(holding.symbol)} / ${number(holding.quantity)}</div>
      </td>
      <td>
        <div class="tag-row">
          ${themes.map((theme) => `<span class="tag">${escapeHtml(theme)}</span>`).join("")}
        </div>
      </td>
      <td>${yen(holding.marketValueJPY)}</td>
      <td class="${valueClass(holding.unrealizedPnlJPY)}">
        ${yen(holding.unrealizedPnlJPY)}<br />
        <span>${pct(holding.unrealizedPnlPercent)}</span>
      </td>
      <td>
        <div class="row-actions">
          <button class="small-button" type="button" data-edit-holding="${escapeAttr(holding.id)}">編集</button>
          <button class="small-button danger" type="button" data-delete-holding="${escapeAttr(holding.id)}">削除</button>
        </div>
      </td>
    </tr>
  `;
}

function renderExposures() {
  els.exposureGrid.className = "exposure-grid";
  els.exposureGrid.innerHTML = [
    exposureBlock("資産クラス", exposureBy("assetType", assetTypeLabel)),
    exposureBlock("通貨", exposureBy("currency")),
    exposureBlock("地域", exposureBy("region")),
    exposureBlock("セクター", exposureBy("sector"))
  ].join("");
}

function exposureBlock(title, rows) {
  return `
    <div class="exposure-block">
      <h3>${escapeHtml(title)}</h3>
      <div class="exposure-list">
        ${rows.map((row) => `
          <div class="exposure-row">
            <div>
              <strong>${escapeHtml(row.label)}</strong>
              <span>${yen(row.value)}</span>
            </div>
            <div class="bar-track">
              <span style="width:${Math.max(2, row.ratio * 100).toFixed(1)}%"></span>
            </div>
            <em>${pct(row.ratio)}</em>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function exposureBy(field, labeler = (value) => value) {
  const holdings = allHoldings();
  const total = holdings.reduce((sum, holding) => sum + Math.max(0, holding.marketValueJPY || 0), 0);
  const map = new Map();
  for (const holding of holdings) {
    const key = holding[field] || "Other";
    map.set(key, (map.get(key) || 0) + Math.max(0, holding.marketValueJPY || 0));
  }
  return Array.from(map.entries())
    .map(([key, value]) => ({
      key,
      label: labeler(key),
      value,
      ratio: total ? value / total : 0
    }))
    .sort((a, b) => b.value - a.value);
}

function renderFocus() {
  const newsItems = [...(state.news?.items || [])].sort((a, b) => b.score - a.score).slice(0, 8);
  const eventItems = sortedEvents().slice(0, 5);
  const matches = newsItems
    .map((item) => ({ item, impacts: impactedHoldingsForTags(item.tags || []) }))
    .filter((entry) => entry.impacts.length);

  els.focusList.className = "focus-list";
  els.focusList.innerHTML = `
    <div class="focus-group">
      <h3>ニュースから見る影響候補</h3>
      ${matches.length ? matches.slice(0, 5).map(renderNewsImpact).join("") : `<div class="empty compact">該当するニュースがありません</div>`}
    </div>
    <div class="focus-group">
      <h3>近い重要イベント</h3>
      ${eventItems.map(renderEventImpact).join("")}
    </div>
  `;
}

function renderNewsImpact({ item, impacts }) {
  return `
    <article class="focus-card">
      <div class="focus-score">${number(item.score)}</div>
      <div>
        <a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
        <div class="muted-line">
          ${escapeHtml(item.source || item.feedSource || "")}
          ${item.publishedAt ? ` / ${formatDateTime(item.publishedAt)}` : ""}
        </div>
        <div class="tag-row">
          ${(item.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="impact-line">${impacts.map((holding) => escapeHtml(holding.name)).join("、")}</div>
      </div>
    </article>
  `;
}

function renderEventImpact(event) {
  const impacts = impactedHoldingsForThemes(EVENT_THEME_MAP[event.category] || []);
  return `
    <article class="focus-card">
      <div class="focus-date">${eventDateRange(event)}</div>
      <div>
        <strong>${escapeHtml(event.title)}</strong>
        <div class="muted-line">${escapeHtml(event.region)} / ${escapeHtml(event.timeJST || "")} / ${event.daysUntil === 0 ? "今日" : `${event.daysUntil}日後`}</div>
        <div class="impact-line">${impacts.length ? impacts.map((holding) => escapeHtml(holding.name)).join("、") : "市場全体"}</div>
      </div>
    </article>
  `;
}

function impactedHoldingsForTags(tags) {
  const themes = new Set();
  for (const tag of tags) {
    for (const theme of TAG_THEME_MAP[tag] || []) themes.add(theme);
  }
  return impactedHoldingsForThemes(Array.from(themes));
}

function impactedHoldingsForThemes(themes) {
  const themeSet = new Set(themes);
  return allHoldings()
    .map((holding) => {
      const holdingThemes = new Set(holding.themes || []);
      let score = 0;
      for (const theme of themeSet) {
        if (holdingThemes.has(theme)) score += 1;
      }
      return { holding, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.holding.marketValueJPY - a.holding.marketValueJPY)
    .slice(0, 4)
    .map((entry) => entry.holding);
}

function renderNews() {
  const items = state.news?.items || [];
  els.newsList.className = "news-list";
  els.newsStatus.textContent = state.news?.fromCache ? "cache" : state.news?.fetchedAt ? `取得: ${formatDateTime(state.news.fetchedAt)}` : "";
  if (!items.length) {
    els.newsList.innerHTML = `<div class="empty">ニュースを取得できませんでした</div>`;
    return;
  }
  els.newsList.innerHTML = items.slice(0, 12).map((item) => `
    <article class="news-card">
      <div class="news-meta">
        <span>${escapeHtml(item.source || item.feedSource || "")}</span>
        <span>${item.publishedAt ? formatDateTime(item.publishedAt) : ""}</span>
        <span class="tag ${item.score >= 40 ? "hot" : item.score >= 24 ? "mid" : ""}">score ${number(item.score)}</span>
      </div>
      <a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
      <div class="tag-row">
        ${(item.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
    </article>
  `).join("");
}

function renderEvents() {
  const items = sortedEvents().slice(0, 12);
  els.eventList.className = "event-list";
  if (!items.length) {
    els.eventList.innerHTML = `<div class="empty">イベントがありません</div>`;
    return;
  }
  els.eventList.innerHTML = items.map((event) => `
    <article class="event-card">
      <div class="event-date">
        <strong>${eventDateRange(event)}</strong>
        <span>${escapeHtml(event.timeJST || "")}</span>
      </div>
      <div>
        <div class="event-meta">
          <span>${escapeHtml(event.region)}</span>
          <span class="status-pill ${escapeAttr(event.status)}">${statusLabel(event.status)}</span>
          <span>${"★".repeat(event.importance)}${"☆".repeat(5 - event.importance)}</span>
        </div>
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.note || "")}</p>
      </div>
      <a href="${escapeAttr(event.sourceUrl || "#")}" target="_blank" rel="noreferrer">Source</a>
    </article>
  `).join("");
}

function sortedEvents() {
  const items = [...(state.events?.items || [])];
  if (state.eventSort === "date") {
    return items.sort((a, b) => a.date.localeCompare(b.date) || b.importance - a.importance);
  }
  return items.sort((a, b) => b.priorityScore - a.priorityScore || a.date.localeCompare(b.date));
}

function allHoldings() {
  return (state.summary?.portfolios || []).flatMap((portfolio) => portfolio.holdings || []);
}

async function saveHolding(values) {
  const payload = {
    ...values,
    quantity: Number(values.quantity || 0),
    price: Number(values.price || 0),
    fxRate: Number(values.fxRate || 0)
  };
  const result = await api("/api/holdings", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.summary = result.state;
  renderAll();
  clearHoldingForm();
  toast("サンプル銘柄を保存しました");
}

async function deleteHolding(id) {
  const result = await api(`/api/holdings/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  state.summary = result.state;
  renderAll();
  clearHoldingForm();
  toast("サンプル銘柄を削除しました");
}

async function resetDemoPortfolio() {
  if (!window.confirm("サンプルポートフォリオを初期状態に戻しますか？")) return;
  const result = await api("/api/reset-demo", {
    method: "POST",
    body: JSON.stringify({})
  });
  state.summary = result.state;
  renderAll();
  clearHoldingForm();
  toast("サンプルに戻しました");
}

function fillHoldingForm(holding) {
  const form = els.holdingForm.elements;
  form.id.value = holding.id || "";
  form.symbol.value = holding.symbol || "";
  form.name.value = holding.name || "";
  form.assetType.value = holding.assetType || "stock-jp";
  form.quantity.value = holding.quantity || "";
  form.price.value = holding.averageCostNative || holding.latestPrice || "";
  form.currency.value = holding.currency || (holding.assetType === "stock-us" ? "USD" : "JPY");
  form.fxRate.value = holding.fxRate || "";
  form.region.value = holding.region || "";
  form.sector.value = holding.sector || "";
  form.themes.value = (holding.themes || []).join(", ");
  form.symbol.focus();
}

function clearHoldingForm() {
  els.holdingForm.reset();
  const form = els.holdingForm.elements;
  form.id.value = "";
  form.assetType.value = "stock-jp";
  form.currency.value = "JPY";
  form.region.value = "Japan";
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json();
}

function metricCard(label, value, className) {
  return `
    <article class="metric-card ${className || ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function kpi(label, value, className) {
  return `
    <div class="kpi">
      <span>${escapeHtml(label)}</span>
      <strong class="${className || ""}">${escapeHtml(value)}</strong>
    </div>
  `;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => {
    els.toast.hidden = true;
  }, 1800);
}

function yen(value) {
  const numberValue = Number(value || 0);
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(numberValue);
}

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function number(value) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function valueClass(value) {
  const numberValue = Number(value || 0);
  if (numberValue > 0) return "positive";
  if (numberValue < 0) return "negative";
  return "";
}

function assetTypeLabel(assetType) {
  return {
    "stock-jp": "日本株",
    "stock-us": "米国株",
    fund: "投資信託",
    etf: "ETF",
    crypto: "暗号資産",
    cash: "現金"
  }[assetType] || assetType || "Other";
}

function shortDate(ymd) {
  if (!ymd) return "";
  const [, month, day] = ymd.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function eventDateRange(event) {
  if (!event.endDate) return shortDate(event.date);
  return `${shortDate(event.date)}-${shortDate(event.endDate)}`;
}

function formatDateTime(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function statusLabel(status) {
  return {
    confirmed: "確定",
    expected: "予定",
    watch: "監視"
  }[status] || status;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}
