import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const EVENT_HORIZON_DATE = process.env.EVENT_HORIZON_DATE || "2026-09-30";
const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const NEWS_FEEDS = [
  {
    source: "Yahoo!ニュース 経済",
    url: "https://news.yahoo.co.jp/rss/topics/business.xml"
  },
  {
    source: "NHK NEWS WEB 経済",
    url: "https://www.nhk.or.jp/rss/news/cat5.xml"
  },
  {
    source: "Google News 市場",
    url:
      "https://news.google.com/rss/search?q=%E7%B5%8C%E6%B8%88%20OR%20%E7%82%BA%E6%9B%BF%20OR%20%E6%A0%AA%E4%BE%A1%20OR%20%E6%97%A5%E9%8A%80%20OR%20FOMC&hl=ja&gl=JP&ceid=JP:ja"
  },
  {
    source: "Google News 原油・中東",
    url:
      "https://news.google.com/rss/search?q=%E5%8E%9F%E6%B2%B9%20OR%20%E4%B8%AD%E6%9D%B1%20OR%20OPEC&hl=ja&gl=JP&ceid=JP:ja"
  }
];

const ECONOMIC_KEYWORDS = [
  ["日銀", "金融政策", 18],
  ["植田", "金融政策", 12],
  ["FOMC", "金融政策", 18],
  ["FRB", "金融政策", 14],
  ["金利", "金利", 14],
  ["利上げ", "金利", 16],
  ["利下げ", "金利", 16],
  ["CPI", "物価", 16],
  ["PCE", "物価", 16],
  ["インフレ", "物価", 13],
  ["雇用統計", "雇用", 16],
  ["雇用", "雇用", 10],
  ["GDP", "景気", 12],
  ["為替", "為替", 14],
  ["円高", "為替", 14],
  ["円安", "為替", 14],
  ["ドル", "為替", 8],
  ["株価", "株式", 12],
  ["日経平均", "株式", 12],
  ["NASDAQ", "株式", 10],
  ["S&P", "株式", 10],
  ["原油", "資源", 13],
  ["OPEC", "資源", 13],
  ["中東", "地政学", 12],
  ["関税", "政策", 12],
  ["中国", "中国", 7],
  ["米国", "米国", 7],
  ["景気", "景気", 8]
];

const INITIAL_STORE = {
  schemaVersion: 1,
  newsCache: { fetchedAt: null, items: [] },
  portfolios: [
    {
      id: "demo-balanced",
      name: "Balanced Market Watch",
      mode: "standard",
      strategy: "Japan / US equity sample",
      baseCurrency: "JPY",
      transactions: [
        {
          id: "demo-7203",
          portfolioId: "demo-balanced",
          date: "2026-04-01",
          type: "buy",
          assetType: "stock-jp",
          symbol: "7203.T",
          name: "Toyota Motor",
          quantity: 100,
          price: 2850,
          currency: "JPY",
          amountJPY: 285000,
          feeJPY: 0,
          sector: "Automobiles",
          region: "Japan",
          themes: ["equity", "cyclical", "fx", "china"]
        },
        {
          id: "demo-8035",
          portfolioId: "demo-balanced",
          date: "2026-04-01",
          type: "buy",
          assetType: "stock-jp",
          symbol: "8035.T",
          name: "Tokyo Electron",
          quantity: 10,
          price: 28000,
          currency: "JPY",
          amountJPY: 280000,
          feeJPY: 0,
          sector: "Semiconductors",
          region: "Japan",
          themes: ["equity", "growth", "semiconductor", "china"]
        },
        {
          id: "demo-5020",
          portfolioId: "demo-balanced",
          date: "2026-04-01",
          type: "buy",
          assetType: "stock-jp",
          symbol: "5020.T",
          name: "ENEOS Holdings",
          quantity: 300,
          price: 760,
          currency: "JPY",
          amountJPY: 228000,
          feeJPY: 0,
          sector: "Energy",
          region: "Japan",
          themes: ["equity", "energy", "inflation", "defensive"]
        },
        {
          id: "demo-aapl",
          portfolioId: "demo-balanced",
          date: "2026-04-01",
          type: "buy",
          assetType: "stock-us",
          symbol: "AAPL",
          name: "Apple",
          quantity: 8,
          price: 190,
          currency: "USD",
          fxRate: 155,
          feeJPY: 0,
          sector: "Technology",
          region: "United States",
          themes: ["equity", "growth", "us", "fx", "consumer"]
        },
        {
          id: "demo-voo",
          portfolioId: "demo-balanced",
          date: "2026-04-01",
          type: "buy",
          assetType: "stock-us",
          symbol: "VOO",
          name: "Vanguard S&P 500 ETF",
          quantity: 4,
          price: 510,
          currency: "USD",
          fxRate: 155,
          feeJPY: 0,
          sector: "Broad Market",
          region: "United States",
          themes: ["equity", "growth", "us", "rates"]
        }
      ],
      recurringRules: []
    }
  ],
  eventOverrides: []
};

const BASE_EVENTS = [
  {
    id: "boj-2026-06",
    date: "2026-06-15",
    endDate: "2026-06-16",
    timeJST: "会合後",
    region: "日本",
    title: "日銀 金融政策決定会合",
    importance: 5,
    status: "confirmed",
    category: "central-bank",
    sourceUrl: "https://www.boj.or.jp/mopo/mpmsche_minu/index.htm",
    note: "結果公表時刻は固定されないため、会合後の発表を監視。"
  },
  {
    id: "fomc-2026-06-rate",
    date: "2026-06-18",
    timeJST: "03:00",
    region: "米国",
    title: "FOMC 政策金利",
    importance: 5,
    status: "confirmed",
    category: "central-bank",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    note: "米国 6/16-17 会合の結果。"
  },
  {
    id: "fomc-2026-06-presser",
    date: "2026-06-18",
    timeJST: "03:30",
    region: "米国",
    title: "FRB議長会見",
    importance: 5,
    status: "confirmed",
    category: "central-bank",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    note: "ドットチャート・声明文との整合性を見る。"
  },
  {
    id: "pce-2026-06",
    date: "2026-06-25",
    timeJST: "21:30",
    region: "米国",
    title: "PCE物価指数",
    importance: 4,
    status: "expected",
    category: "inflation",
    sourceUrl: "https://www.bea.gov/news/schedule",
    note: "FRBが重視するインフレ指標。発表日は公式カレンダーで最終確認。"
  },
  {
    id: "oil-middle-east-2026-06",
    date: "2026-06-20",
    timeJST: "随時",
    region: "世界",
    title: "中東・原油ニュース",
    importance: 5,
    status: "watch",
    category: "geopolitics",
    sourceUrl: "https://www.opec.org/opec_web/en/press_room/28.htm",
    note: "日程未確定。原油・為替・インフレ期待への波及を監視。"
  },
  {
    id: "jobs-2026-07",
    date: "2026-07-02",
    timeJST: "21:30",
    region: "米国",
    title: "雇用統計",
    importance: 5,
    status: "expected",
    category: "employment",
    sourceUrl: "https://www.bls.gov/schedule/news_release/empsit.htm",
    note: "米国祝日前後のため通常より前倒し。"
  },
  {
    id: "cpi-2026-07",
    date: "2026-07-14",
    timeJST: "21:30",
    region: "米国",
    title: "CPI",
    importance: 5,
    status: "expected",
    category: "inflation",
    sourceUrl: "https://www.bls.gov/schedule/news_release/cpi.htm",
    note: "金利見通し・ドル円・株式バリュエーションに直結。"
  },
  {
    id: "ppi-2026-07",
    date: "2026-07-15",
    timeJST: "21:30",
    region: "米国",
    title: "PPI",
    importance: 3,
    status: "expected",
    category: "inflation",
    sourceUrl: "https://www.bls.gov/schedule/news_release/ppi.htm",
    note: "CPI後の追加材料。"
  },
  {
    id: "opec-2026-07",
    date: "2026-07-13",
    timeJST: "未定",
    region: "世界",
    title: "OPEC月報",
    importance: 3,
    status: "expected",
    category: "commodity",
    sourceUrl: "https://www.opec.org/opec_web/en/publications/338.htm",
    note: "需給見通しと原油価格への反応を見る。"
  },
  {
    id: "fomc-2026-07-rate",
    date: "2026-07-30",
    timeJST: "03:00",
    region: "米国",
    title: "FOMC 政策金利",
    importance: 5,
    status: "confirmed",
    category: "central-bank",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    note: "米国 7/28-29 会合の結果。"
  },
  {
    id: "boj-2026-07",
    date: "2026-07-30",
    endDate: "2026-07-31",
    timeJST: "会合後",
    region: "日本",
    title: "日銀会合 + 展望レポート",
    importance: 5,
    status: "confirmed",
    category: "central-bank",
    sourceUrl: "https://www.boj.or.jp/mopo/mpmsche_minu/index.htm",
    note: "展望レポートあり。物価見通しと追加利上げ示唆を確認。"
  },
  {
    id: "jobs-2026-08",
    date: "2026-08-07",
    timeJST: "21:30",
    region: "米国",
    title: "雇用統計",
    importance: 5,
    status: "expected",
    category: "employment",
    sourceUrl: "https://www.bls.gov/schedule/news_release/empsit.htm",
    note: "9月FOMCに向けた雇用側の主要材料。"
  },
  {
    id: "cpi-2026-08",
    date: "2026-08-12",
    timeJST: "21:30",
    region: "米国",
    title: "CPI",
    importance: 5,
    status: "expected",
    category: "inflation",
    sourceUrl: "https://www.bls.gov/schedule/news_release/cpi.htm",
    note: "夏場のインフレ再加速/鈍化を確認。"
  },
  {
    id: "opec-2026-08",
    date: "2026-08-12",
    timeJST: "未定",
    region: "世界",
    title: "OPEC月報",
    importance: 3,
    status: "expected",
    category: "commodity",
    sourceUrl: "https://www.opec.org/opec_web/en/publications/338.htm",
    note: "原油需給とインフレ期待を確認。"
  },
  {
    id: "jp-gdp-2026-08",
    date: "2026-08-17",
    timeJST: "08:50",
    region: "日本",
    title: "GDP速報",
    importance: 4,
    status: "expected",
    category: "growth",
    sourceUrl: "https://www.esri.cao.go.jp/jp/sna/sokuhou/sokuhou_top.html",
    note: "日銀の景気判断と日本株・円金利を見る。"
  },
  {
    id: "jp-cpi-2026-08",
    date: "2026-08-21",
    timeJST: "08:30",
    region: "日本",
    title: "全国CPI",
    importance: 4,
    status: "expected",
    category: "inflation",
    sourceUrl: "https://www.stat.go.jp/data/cpi/sokuhou/tsuki/index-z.html",
    note: "日銀会合前の国内物価材料。"
  },
  {
    id: "jobs-2026-09",
    date: "2026-09-04",
    timeJST: "21:30",
    region: "米国",
    title: "雇用統計",
    importance: 5,
    status: "expected",
    category: "employment",
    sourceUrl: "https://www.bls.gov/schedule/news_release/empsit.htm",
    note: "9月FOMC前の最後の雇用統計。"
  },
  {
    id: "jp-gdp-revised-2026-09",
    date: "2026-09-08",
    timeJST: "08:50",
    region: "日本",
    title: "GDP改定値",
    importance: 3,
    status: "expected",
    category: "growth",
    sourceUrl: "https://www.esri.cao.go.jp/jp/sna/sokuhou/sokuhou_top.html",
    note: "速報値からの修正幅を見る。"
  },
  {
    id: "opec-2026-09",
    date: "2026-09-10",
    timeJST: "未定",
    region: "世界",
    title: "OPEC月報",
    importance: 3,
    status: "expected",
    category: "commodity",
    sourceUrl: "https://www.opec.org/opec_web/en/publications/338.htm",
    note: "秋以降の需要見通しを確認。"
  },
  {
    id: "cpi-2026-09",
    date: "2026-09-11",
    timeJST: "21:30",
    region: "米国",
    title: "CPI",
    importance: 5,
    status: "expected",
    category: "inflation",
    sourceUrl: "https://www.bls.gov/schedule/news_release/cpi.htm",
    note: "FOMC直前の最大材料。"
  },
  {
    id: "fomc-2026-09-rate",
    date: "2026-09-17",
    timeJST: "03:00",
    region: "米国",
    title: "FOMC + 金利見通し",
    importance: 5,
    status: "confirmed",
    category: "central-bank",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    note: "Summary of Economic Projections あり。"
  },
  {
    id: "boj-2026-09",
    date: "2026-09-17",
    endDate: "2026-09-18",
    timeJST: "会合後",
    region: "日本",
    title: "日銀 金融政策決定会合",
    importance: 5,
    status: "confirmed",
    category: "central-bank",
    sourceUrl: "https://www.boj.or.jp/mopo/mpmsche_minu/index.htm",
    note: "FOMC直後でドル円・日本株の反応が大きくなりやすい。"
  },
  {
    id: "jp-cpi-2026-09",
    date: "2026-09-18",
    timeJST: "08:30",
    region: "日本",
    title: "全国CPI",
    importance: 4,
    status: "expected",
    category: "inflation",
    sourceUrl: "https://www.stat.go.jp/data/cpi/sokuhou/tsuki/index-z.html",
    note: "日銀会合期間中の国内物価材料。"
  }
];

const COINGECKO_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche-2"
};

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

let runtimeNewsCache = null;

async function main() {
  await ensureStore();
  const server = http.createServer(async (req, res) => {
    try {
      await route(req, res);
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { error: "internal_error", message: error.message });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Market portfolio dashboard running at http://${HOST}:${PORT}`);
  });
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/state" && req.method === "GET") {
    const store = await readStore();
    const summary = await buildStateSummary(store);
    sendJson(res, 200, summary);
    return;
  }

  if (url.pathname === "/api/news" && req.method === "GET") {
    const force = url.searchParams.get("refresh") === "1";
    const store = await readStore();
    const news = await getNews(store, force);
    sendJson(res, 200, news);
    return;
  }

  if (url.pathname === "/api/events" && req.method === "GET") {
    const store = await readStore();
    const events = await getEvents(store);
    sendJson(res, 200, events);
    return;
  }

  if (url.pathname === "/api/holdings" && req.method === "POST") {
    const body = await readBody(req);
    const store = await readStore();
    const tx = normalizeHoldingInput(body);
    const portfolio = findPortfolio(store, "demo-balanced");
    const existingIndex = portfolio.transactions.findIndex(
      (entry) => entry.id === tx.id || entry.symbol.toUpperCase() === tx.symbol.toUpperCase()
    );
    if (existingIndex >= 0) {
      portfolio.transactions[existingIndex] = {
        ...portfolio.transactions[existingIndex],
        ...tx,
        id: portfolio.transactions[existingIndex].id
      };
    } else {
      portfolio.transactions.push(tx);
    }
    await writeStore(store);
    sendJson(res, 200, { holding: tx, state: await buildStateSummary(store) });
    return;
  }

  if (url.pathname.startsWith("/api/holdings/") && req.method === "DELETE") {
    const [, , , holdingId] = url.pathname.split("/");
    const store = await readStore();
    const portfolio = findPortfolio(store, "demo-balanced");
    const decodedId = decodeURIComponent(holdingId || "");
    const before = portfolio.transactions.length;
    portfolio.transactions = portfolio.transactions.filter((tx) => tx.id !== decodedId);
    if (portfolio.transactions.length === before) {
      sendJson(res, 404, { error: "holding_not_found" });
      return;
    }
    await writeStore(store);
    sendJson(res, 200, { deletedId: decodedId, state: await buildStateSummary(store) });
    return;
  }

  if (url.pathname === "/api/reset-demo" && req.method === "POST") {
    const store = freshInitialStore();
    await writeStore(store);
    sendJson(res, 200, { state: await buildStateSummary(store) });
    return;
  }

  if (url.pathname === "/api/quotes" && req.method === "GET") {
    const symbols = (url.searchParams.get("symbols") || "")
      .split(",")
      .map((symbol) => symbol.trim())
      .filter(Boolean);
    const quotes = await getQuotes(symbols);
    sendJson(res, 200, { quotes });
    return;
  }

  await serveStatic(url.pathname, res);
}

async function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(content);
  } catch {
    sendText(res, 404, "Not found");
  }
}

async function ensureStore() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    await writeFile(STORE_PATH, JSON.stringify(freshInitialStore(), null, 2));
  }
}

function freshInitialStore() {
  return JSON.parse(JSON.stringify(INITIAL_STORE));
}

async function readStore() {
  await ensureStore();
  const raw = await readFile(STORE_PATH, "utf8");
  const store = JSON.parse(raw);
  return migrateStore(store);
}

async function writeStore(store) {
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

function migrateStore(store) {
  const next = { ...INITIAL_STORE, ...store };
  next.portfolios = (store.portfolios || INITIAL_STORE.portfolios).map((portfolio) => ({
    transactions: [],
    recurringRules: [],
    ...portfolio
  }));
  next.newsCache = next.newsCache || { fetchedAt: null, items: [] };
  next.eventOverrides = next.eventOverrides || [];
  return next;
}

async function getNews(store, force = false) {
  const fetchedAt = runtimeNewsCache?.fetchedAt ? new Date(runtimeNewsCache.fetchedAt) : null;
  const freshEnough = fetchedAt && Date.now() - fetchedAt.getTime() < 30 * 60 * 1000;
  if (!force && freshEnough && runtimeNewsCache.items?.length) {
    return {
      fetchedAt: runtimeNewsCache.fetchedAt,
      fromCache: true,
      items: runtimeNewsCache.items
    };
  }

  const settled = await Promise.allSettled(
    NEWS_FEEDS.map(async (feed) => parseRssFeed(feed, await fetchText(feed.url, 9000)))
  );
  const items = settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .map(scoreNewsItem)
    .filter((item) => item.score > 0);

  const deduped = dedupeByUrlOrTitle(items);
  const today = todayJst();
  const todayItems = deduped.filter((item) => item.publishedDateJST === today);
  let preferred = (todayItems.length >= 6 ? todayItems : deduped)
    .sort((a, b) => b.score - a.score || String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .slice(0, 18);

  if (!preferred.length) {
    preferred = fallbackNewsItems().map(scoreNewsItem);
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    fromCache: false,
    failedSources: settled
      .map((result, index) => (result.status === "rejected" ? NEWS_FEEDS[index].source : null))
      .filter(Boolean),
    items: preferred
  };

  runtimeNewsCache = payload;

  return payload;
}

function fallbackNewsItems() {
  const now = new Date();
  return [
    {
      id: "sample-fomc",
      source: "Sample News",
      feedSource: "Sample",
      title: "FOMC議事要旨を前に米金利とドル円の変動に警戒",
      url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
      publishedAt: now.toISOString(),
      publishedDateJST: todayJst()
    },
    {
      id: "sample-oil",
      source: "Sample News",
      feedSource: "Sample",
      title: "中東情勢とOPEC供給見通しで原油関連株に注目",
      url: "https://www.opec.org/opec_web/en/publications/338.htm",
      publishedAt: now.toISOString(),
      publishedDateJST: todayJst()
    },
    {
      id: "sample-cpi",
      source: "Sample News",
      feedSource: "Sample",
      title: "米CPI発表を控えインフレ再加速とハイテク株のバリュエーションを確認",
      url: "https://www.bls.gov/schedule/news_release/cpi.htm",
      publishedAt: now.toISOString(),
      publishedDateJST: todayJst()
    }
  ];
}

function parseRssFeed(feed, xml) {
  const blocks = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map((match) => match[0]);
  return blocks.map((block) => {
    const title = decodeXml(getXmlTag(block, "title"));
    const link = decodeXml(getXmlTag(block, "link"));
    const pubDate = decodeXml(getXmlTag(block, "pubDate") || getXmlTag(block, "dc:date"));
    const source = decodeXml(getXmlTag(block, "source")) || feed.source;
    const published = pubDate ? new Date(pubDate) : null;
    return {
      id: stableId(`${feed.source}:${title}:${link}`),
      source,
      feedSource: feed.source,
      title,
      url: normalizeNewsUrl(link),
      publishedAt: published && !Number.isNaN(published.getTime()) ? published.toISOString() : null,
      publishedDateJST:
        published && !Number.isNaN(published.getTime()) ? formatJstDate(published) : null
    };
  });
}

function scoreNewsItem(item) {
  const title = `${item.title || ""}`;
  const tags = new Map();
  let score = 0;
  for (const [keyword, tag, value] of ECONOMIC_KEYWORDS) {
    if (title.toLowerCase().includes(String(keyword).toLowerCase())) {
      tags.set(tag, (tags.get(tag) || 0) + value);
      score += value;
    }
  }
  if (item.publishedDateJST === todayJst()) score += 8;
  if (item.feedSource?.includes("Yahoo")) score += 2;
  if (item.feedSource?.includes("NHK")) score += 2;

  return {
    ...item,
    score,
    tags: Array.from(tags.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 4)
  };
}

function dedupeByUrlOrTitle(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = item.url || item.title.replace(/\s+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function normalizeNewsUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const googleTarget = parsed.searchParams.get("url");
    return googleTarget || url;
  } catch {
    return url;
  }
}

async function getEvents(store) {
  const today = todayJst();
  const sourceUpdates = await Promise.allSettled([fetchFomcEvents(2026)]);
  const dynamicFomc = sourceUpdates[0].status === "fulfilled" ? sourceUpdates[0].value : [];
  const merged = mergeEvents(BASE_EVENTS, dynamicFomc, store.eventOverrides || []);

  const events = merged
    .map((event) => ({
      ...event,
      daysUntil: daysBetween(today, event.date),
      priorityScore: event.importance * 100 - Math.max(daysBetween(today, event.date), 0)
    }))
    .filter((event) => event.date >= today || event.endDate >= today)
    .filter((event) => event.date <= EVENT_HORIZON_DATE)
    .sort((a, b) => b.priorityScore - a.priorityScore || a.date.localeCompare(b.date));

  return {
    generatedAt: new Date().toISOString(),
    sourceStatus: {
      fomc: sourceUpdates[0].status === "fulfilled" && dynamicFomc.length ? "synced" : "seed"
    },
    items: events
  };
}

function mergeEvents(...eventGroups) {
  const map = new Map();
  for (const group of eventGroups) {
    for (const event of group || []) {
      map.set(event.id, { ...(map.get(event.id) || {}), ...event });
    }
  }
  return Array.from(map.values());
}

async function fetchFomcEvents(year) {
  const html = await fetchText("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", 9000);
  const pageText = stripHtml(html).replace(/\s+/g, " ");
  const section = pageText.match(new RegExp(`${year}\\s+FOMC Meetings([\\s\\S]*?)${year - 1}\\s+FOMC Meetings`));
  if (!section) return [];
  const text = section[1];
  const monthNumbers = {
    January: 1,
    February: 2,
    March: 3,
    April: 4,
    May: 5,
    June: 6,
    July: 7,
    September: 9,
    October: 10,
    December: 12
  };
  const events = [];
  const regex =
    /(January|February|March|April|May|June|July|September|October|December)\s+(\d{1,2})-(\d{1,2})(\*)?/g;
  for (const match of text.matchAll(regex)) {
    const [, monthName, , endDay, projection] = match;
    const month = monthNumbers[monthName];
    const decision = easternPolicyDecisionToJst(year, month, Number(endDay));
    events.push({
      id: `fomc-${year}-${String(month).padStart(2, "0")}-rate`,
      date: decision.date,
      timeJST: decision.time,
      region: "米国",
      title: projection ? "FOMC + 金利見通し" : "FOMC 政策金利",
      importance: 5,
      status: "confirmed",
      category: "central-bank",
      sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
      note: projection ? "Summary of Economic Projections あり。" : "米国FOMC会合の結果。"
    });
  }
  return events;
}

function easternPolicyDecisionToJst(year, month, day) {
  const isDst = month > 3 && month < 11;
  const jstHour = isDst ? "03:00" : "04:00";
  return { date: addDays(toYmd(year, month, day), 1), time: jstHour };
}

async function buildStateSummary(store) {
  const quotes = await getQuotes(symbolsInStore(store));
  const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const portfolios = store.portfolios.map((portfolio) => summarizePortfolio(portfolio, quoteMap));
  return {
    asOf: new Date().toISOString(),
    todayJST: todayJst(),
    portfolios
  };
}

function summarizePortfolio(portfolio, quoteMap) {
  const cash = { JPY: 0, USD: 0 };
  const cashStats = {
    JPY: { deposits: 0, withdrawals: 0 },
    USD: { deposits: 0, withdrawals: 0, spent: 0, received: 0 }
  };
  const holdings = new Map();
  let netDepositsJPY = 0;
  let withdrawalsJPY = 0;
  let realizedPnlJPY = 0;
  let buyPrincipalJPY = 0;

  const transactions = [...(portfolio.transactions || [])].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of transactions) {
    const amountJPY = Number(tx.amountJPY || 0);
    if (tx.type === "deposit") {
      cash.JPY += amountJPY;
      cashStats.JPY.deposits += amountJPY;
      netDepositsJPY += amountJPY;
      continue;
    }
    if (tx.type === "withdraw") {
      cash.JPY -= amountJPY;
      cashStats.JPY.withdrawals += amountJPY;
      withdrawalsJPY += amountJPY;
      continue;
    }
    if (tx.type === "cash-usd") {
      const quantity = Number(tx.quantity || 0);
      const fxRate =
        Number(tx.fxRate || 0) || quoteMap.get("USDJPY=X")?.price || 0;
      const principalJPY = amountJPY || quantity * fxRate;
      cash.USD += quantity;
      cashStats.USD.deposits += quantity;
      netDepositsJPY += principalJPY;
      continue;
    }
    if (tx.type === "cash-usd-withdraw") {
      const quantity = Number(tx.quantity || 0);
      const fxRate =
        Number(tx.fxRate || 0) || quoteMap.get("USDJPY=X")?.price || 0;
      cash.USD -= quantity;
      cashStats.USD.withdrawals += quantity;
      withdrawalsJPY += amountJPY || quantity * fxRate;
      continue;
    }

    if (tx.type === "buy" || tx.type === "scheduled-buy") {
      const key = tx.symbol;
      const current = holdings.get(key) || emptyHolding(tx);
      const quantity = Number(tx.quantity || 0);
      const nativeCost = transactionNativeValue(tx);
      const costJPY = isUsdStockTransaction(tx)
        ? nativeCost * (Number(tx.fxRate || 0) || quoteMap.get("USDJPY=X")?.price || 0)
        : amountJPY || transactionMarketValueJPY(tx, quoteMap);
      current.quantity += quantity;
      current.costNative += nativeCost;
      current.costJPY += costJPY + Number(tx.feeJPY || 0);
      current.transactions += 1;
      holdings.set(key, current);
      buyPrincipalJPY += costJPY + Number(tx.feeJPY || 0);
      if (isUsdStockTransaction(tx)) {
        cashStats.USD.spent += nativeCost;
      }
      continue;
    }

    if (tx.type === "sell") {
      const key = tx.symbol;
      const current = holdings.get(key) || emptyHolding(tx);
      const quantity = Number(tx.quantity || 0);
      const proceedsNative = transactionNativeValue(tx);
      const proceedsJPY = isUsdStockTransaction(tx)
        ? proceedsNative * (Number(tx.fxRate || 0) || quoteMap.get("USDJPY=X")?.price || 0)
        : amountJPY || transactionMarketValueJPY(tx, quoteMap);
      const avgCost = current.quantity ? current.costJPY / current.quantity : 0;
      const avgNativeCost = current.quantity ? current.costNative / current.quantity : 0;
      const costOut = avgCost * quantity;
      const nativeCostOut = avgNativeCost * quantity;
      current.quantity -= quantity;
      current.costNative -= nativeCostOut;
      current.costJPY -= costOut;
      current.transactions += 1;
      realizedPnlJPY += isUsdStockTransaction(tx)
        ? (proceedsNative - nativeCostOut) * (Number(tx.fxRate || 0) || quoteMap.get("USDJPY=X")?.price || 0) -
          Number(tx.feeJPY || 0)
        : proceedsJPY - costOut - Number(tx.feeJPY || 0);
      holdings.set(key, current);
      if (isUsdStockTransaction(tx)) {
        cashStats.USD.received += proceedsNative;
      }
    }
  }

  const holdingRows = Array.from(holdings.values())
    .filter((holding) => Math.abs(holding.quantity) > 0.00000001)
    .map((holding) => {
      const quote = quoteMap.get(holding.symbol);
      const latestPrice = quote?.price ?? holding.lastPrice ?? 0;
      const fxRate = quote?.currency === "USD" ? quoteMap.get("USDJPY=X")?.price || Number(holding.fxRate || 150) : 1;
      const divisor = priceUnitDivisor(holding);
      const latestPriceJPY = (latestPrice * fxRate) / divisor;
      const marketValueJPY = (latestPrice * holding.quantity * fxRate) / divisor;
      const isUsdStock = holding.assetType === "stock-us" && holding.currency === "USD";
      const averageCostNative = holding.quantity
        ? isUsdStock
          ? holding.costNative / holding.quantity
          : (holding.costJPY / holding.quantity) * divisor
        : 0;
      const unrealizedPnlJPY = isUsdStock
        ? (latestPrice - averageCostNative) * holding.quantity * fxRate
        : marketValueJPY - holding.costJPY;
      return {
        ...holding,
        latestPrice,
        latestPriceJPY,
        averageCostNative,
        averageCostJPY: isUsdStock
          ? averageCostNative * fxRate
          : averageCostNative,
        fxRate,
        quoteCurrency: quote?.currency || holding.currency || "JPY",
        quoteSource: quote?.source || "manual",
        quoteAsOf: quote?.asOf || null,
        marketValueJPY,
        unrealizedPnlJPY,
        unrealizedPnlPercent: isUsdStock
          ? averageCostNative
            ? (latestPrice - averageCostNative) / averageCostNative
            : 0
          : holding.costJPY
            ? (marketValueJPY - holding.costJPY) / holding.costJPY
            : 0
      };
    });

  const usdQuote = quoteMap.get("USDJPY=X");
  const usdValueJPY = cash.USD * (usdQuote?.price || 0);
  const holdingsValueJPY = holdingRows.reduce((sum, holding) => sum + holding.marketValueJPY, 0);
  const holdingsProfitJPY = holdingRows.reduce((sum, holding) => sum + holding.unrealizedPnlJPY, 0);
  const cashJPY = cash.JPY + usdValueJPY;
  const totalAssetsJPY = holdingsValueJPY + cashJPY;
  const cashProfitJPY = cashJPY - netDepositsJPY + withdrawalsJPY;
  const investedPrincipalJPY = buyPrincipalJPY + netDepositsJPY;
  const grossProfitJPY = holdingsProfitJPY + realizedPnlJPY + cashProfitJPY;
  const effectiveProfitJPY = grossProfitJPY;

  return {
    id: portfolio.id,
    name: portfolio.name,
    mode: portfolio.mode,
    strategy: portfolio.strategy || "",
    cash,
    cashStats,
    cashJPY,
    holdingsValueJPY,
    totalAssetsJPY,
    investedPrincipalJPY,
    withdrawalsJPY,
    grossProfitJPY,
    realizedPnlJPY,
    effectiveProfitJPY,
    effectiveProfitPercent: investedPrincipalJPY ? effectiveProfitJPY / investedPrincipalJPY : 0,
    holdings: holdingRows,
    transactions: portfolio.transactions || [],
    recurringRules: portfolio.recurringRules || [],
    fx: {
      USDJPY: usdQuote?.price || null,
      USDJPYAsOf: usdQuote?.asOf || null
    }
  };
}

function emptyHolding(tx) {
  return {
    id: tx.id,
    assetType: tx.assetType || "stock-jp",
    symbol: tx.symbol,
    name: tx.name || tx.symbol,
    currency: tx.currency || "JPY",
    sector: tx.sector || "Other",
    region: tx.region || "Other",
    themes: Array.isArray(tx.themes) ? tx.themes : [],
    quantity: 0,
    costJPY: 0,
    costNative: 0,
    lastPrice: Number(tx.price || 0),
    fxRate: Number(tx.fxRate || 0),
    transactions: 0
  };
}

function isUsdStockTransaction(tx) {
  return tx.assetType === "stock-us" && tx.currency === "USD";
}

function transactionNativeValue(tx) {
  return (Number(tx.quantity || 0) * Number(tx.price || 0)) / priceUnitDivisor(tx);
}

function transactionMarketValueJPY(tx, quoteMap) {
  const quantity = Number(tx.quantity || 0);
  const price = Number(tx.price || 0);
  const currency = tx.currency || "JPY";
  const fxRate =
    Number(tx.fxRate || 0) ||
    (currency === "USD" ? quoteMap.get("USDJPY=X")?.price || 150 : 1);
  return (quantity * price * fxRate) / priceUnitDivisor(tx);
}

function priceUnitDivisor(asset) {
  return asset.assetType === "fund" ? 10000 : 1;
}

function symbolsInStore(store) {
  const symbols = new Set(["USDJPY=X"]);
  for (const portfolio of store.portfolios || []) {
    for (const tx of portfolio.transactions || []) {
      if (tx.symbol && !isCashLikeTransaction(tx)) symbols.add(tx.symbol);
      if (tx.currency === "USD") symbols.add("USDJPY=X");
    }
    for (const rule of portfolio.recurringRules || []) {
      if (rule.symbol) symbols.add(rule.symbol);
    }
  }
  return Array.from(symbols);
}

function isCashLikeTransaction(tx) {
  return ["deposit", "withdraw", "cash-usd", "cash-usd-withdraw"].includes(tx.type);
}

async function getQuotes(symbols) {
  const unique = Array.from(new Set(symbols)).filter(Boolean);
  const results = await Promise.allSettled(unique.map((symbol) => getQuote(symbol)));
  return results.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : {
          symbol: unique[index],
          price: null,
          currency: null,
          source: "unavailable",
          error: result.reason?.message || String(result.reason)
        }
  );
}

async function getQuote(symbol, date = null) {
  const upper = symbol.toUpperCase();
  if (upper in COINGECKO_IDS) return getCryptoQuote(upper);
  return getYahooQuote(symbol, date);
}

async function getCryptoQuote(symbol) {
  const id = COINGECKO_IDS[symbol.toUpperCase()];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    id
  )}&vs_currencies=jpy,usd&include_24hr_change=true&include_last_updated_at=true`;
  const json = await fetchJson(url, 9000);
  const data = json[id];
  if (!data) throw new Error(`CoinGecko price not found: ${symbol}`);
  return {
    symbol,
    price: data.jpy,
    currency: "JPY",
    change24hPercent: data.jpy_24h_change || null,
    asOf: data.last_updated_at ? new Date(data.last_updated_at * 1000).toISOString() : new Date().toISOString(),
    source: "CoinGecko"
  };
}

async function getYahooQuote(symbol, date = null) {
  const url = date ? yahooHistoricalUrl(symbol, date) : yahooLatestUrl(symbol);
  const json = await fetchJson(url, 9000);
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo chart result not found: ${symbol}`);
  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const adjClose = result.indicators?.adjclose?.[0]?.adjclose || [];
  const timestamps = result.timestamp || [];
  const closes = (adjClose.length ? adjClose : quote.close || []).filter((value) => typeof value === "number");
  const price = closes.at(-1) ?? meta.regularMarketPrice;
  if (typeof price !== "number") throw new Error(`Price not found: ${symbol}`);
  const timestamp = timestamps.at(-1) ? new Date(timestamps.at(-1) * 1000).toISOString() : new Date().toISOString();
  return {
    symbol,
    price,
    currency: meta.currency || inferCurrency(symbol),
    asOf: timestamp,
    source: "Yahoo Finance chart"
  };
}

function yahooLatestUrl(symbol) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=5d&interval=1d`;
}

function yahooHistoricalUrl(symbol, date) {
  const start = Math.floor(ymdToDate(addDays(date, -4)).getTime() / 1000);
  const end = Math.floor(ymdToDate(addDays(date, 3)).getTime() / 1000);
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${start}&period2=${end}&interval=1d`;
}

function inferCurrency(symbol) {
  if (symbol.endsWith(".T") || symbol === "JPY=X") return "JPY";
  if (symbol === "USDJPY=X") return "JPY";
  return "USD";
}

function normalizeHoldingInput(body) {
  const symbol = String(body.symbol || "").trim();
  if (!symbol) throw new Error("symbol is required");

  const assetType = body.assetType || "stock-jp";
  const quantity = Number(body.quantity || 0);
  const price = Number(body.price || 0);
  if (!(quantity > 0)) throw new Error("quantity must be greater than 0");
  if (!(price > 0)) throw new Error("price must be greater than 0");

  const currency =
    body.currency ||
    (assetType === "stock-us" ? "USD" : "JPY");
  const amountJPY =
    currency === "JPY"
      ? (quantity * price) / priceUnitDivisor({ assetType })
      : 0;

  return {
    id: body.id || stableId(`holding:${symbol}:${Date.now()}:${Math.random()}`),
    portfolioId: "demo-balanced",
    date: normalizeYmd(body.date || todayJst()),
    type: "buy",
    assetType,
    symbol,
    name: String(body.name || symbol).trim(),
    quantity,
    price,
    currency,
    amountJPY,
    feeJPY: Number(body.feeJPY || 0),
    fxRate: Number(body.fxRate || 0),
    sector: String(body.sector || "Other").trim(),
    region: String(body.region || "Other").trim(),
    themes: normalizeThemeList(body.themes),
    source: "editor"
  };
}

function normalizeThemeList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[,\u3001]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function findPortfolio(store, id) {
  const portfolio = store.portfolios.find((entry) => entry.id === id);
  if (!portfolio) throw new Error(`Portfolio not found: ${id}`);
  return portfolio;
}

async function fetchJson(url, timeoutMs) {
  const text = await fetchText(url, timeoutMs);
  return JSON.parse(text);
}

async function fetchText(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 investment-dashboard/0.1 (+https://localhost; personal-use)"
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body, null, 2));
}

function sendText(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function getXmlTag(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  if (!match) return "";
  return match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function decodeXml(text = "") {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html) {
  return decodeXml(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " "));
}

function stableId(input) {
  let hash = 0;
  const text = String(input);
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return `id_${Math.abs(hash).toString(36)}`;
}

function todayJst() {
  return formatJstDate(new Date());
}

function formatJstDate(date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function normalizeYmd(value) {
  if (typeof value !== "string") return todayJst();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return todayJst();
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function ymdParts(ymd) {
  const [year, month, day] = normalizeYmd(ymd).split("-").map(Number);
  return { year, month, day };
}

function ymdToDate(ymd) {
  const { year, month, day } = ymdParts(ymd);
  return new Date(Date.UTC(year, month - 1, day));
}

function toYmd(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(ymd, days) {
  const date = ymdToDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((ymdToDate(b).getTime() - ymdToDate(a).getTime()) / 86400000);
}

main();
