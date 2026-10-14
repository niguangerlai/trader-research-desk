import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the research workbench", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Trader Research Desk<\/title>/i);
  assert.match(html, /从叙事，到可验证的交易假设/);
  assert.match(html, /自选与持仓/);
  assert.match(html, /增加标的/);
  assert.match(html, /登录后跨设备同步/);
  assert.doesNotMatch(html, /react-loading-skeleton|codex-preview/);
});

test("keeps the local-first research capabilities in source", async () => {
  const [
    page,
    data,
    researchRefresh,
    chartView,
    marketChart,
    pricingOrder,
    orderMath,
    indicators,
    marketRoute,
    binanceMarket,
    yahooMarket,
    researchRoute,
    secEvidence,
    workspaceSync,
    workspaceRoute,
    researchPriority,
    eventRadar,
    eventCalendar,
    decisionLog,
    portfolioRisk,
    weeklyScreen,
    schema,
    wranglerExample,
    styles,
    tokens,
    packageJson,
  ] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/research-refresh-2026-09-30.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/ChartResearchView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/MarketChart.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/PricingOrderView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/order-math.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/indicators.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/market/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/binance-market.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/yahoo-market.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sec-evidence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/workspace-sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/research-priority.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/event-radar.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/event-calendar.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/decision-log.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/portfolio-risk.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/weekly-screen.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.example.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../tokens.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /window\.localStorage/);
  assert.match(page, /importData/);
  assert.match(page, /exportData/);
  assert.match(page, /undoDelete/);
  assert.match(page, /showModal/);
  assert.match(page, /K线与推演/);
  assert.match(page, /AI 生成研究草稿/);
  assert.match(page, /AI 更新逻辑/);
  assert.match(page, /版本对比/);
  assert.match(page, /previousVersion/);
  assert.match(page, /保存为最新版/);
  assert.match(page, /CROSS_ASSET_MIGRATION_KEY/);
  assert.match(page, /EVENT_RADAR_MIGRATION_KEY/);
  assert.match(page, /manual-refresh-2026-09-30/);
  assert.match(page, /mergeMissingDefaultEvents/);
  assert.match(page, /synchronizeWorkspace/);
  assert.match(page, /登录同步/);
  assert.match(page, /今天先看什么/);
  assert.match(page, /优先级只决定研究顺序，不代表买卖方向/);
  assert.match(researchPriority, /buildResearchQueue/);
  assert.match(researchPriority, /旧判断被证伪/);
  assert.match(page, /接下来什么会改变判断/);
  assert.match(page, /没有可靠日期的催化继续留在交易假设中/);
  assert.match(page, /已复盘/);
  assert.match(page, /行动与复盘/);
  assert.match(page, /把“等待”也写成决策/);
  assert.match(page, /完成复盘/);
  assert.match(page, /最近完成的复盘/);
  assert.match(page, /组合风险集中在哪/);
  assert.match(page, /故事分组是透明的研究归因/);
  assert.match(page, /name="portfolioWeight"/);
  assert.match(page, /name="riskTheme"/);
  assert.match(portfolioRisk, /buildPortfolioRisk/);
  assert.match(portfolioRisk, /AI 资本开支链/);
  assert.match(styles, /\.portfolio-risk/);
  assert.match(page, /连续2周阳线/);
  assert.match(page, /排除本周未收盘K线/);
  assert.match(page, /refreshWeeklyScreen/);
  assert.match(weeklyScreen, /evaluateTwoCompletedBullishWeeks/);
  assert.match(weeklyScreen, /isUsListedMarket/);
  assert.match(styles, /\.weekly-screen-status/);
  assert.match(page, /name="keyEvents"/);
  assert.match(eventRadar, /buildEventRadar/);
  assert.match(eventRadar, /reviewLookbackDays/);
  assert.match(eventCalendar, /Jackson Hole/);
  assert.match(eventCalendar, /fomccalendars/);
  assert.match(page, /核对来源/);
  assert.match(styles, /\.event-radar/);
  assert.match(workspaceSync, /mergeWorkspaces/);
  assert.match(workspaceSync, /markAssetDeleted/);
  assert.match(workspaceSync, /decisions/);
  assert.match(decisionLog, /buildDecisionQueue/);
  assert.match(decisionLog, /ORDER_PLAN_STORAGE_KEY/);
  assert.match(workspaceRoute, /getChatGPTUser/);
  assert.match(workspaceRoute, /baseRevision/);
  assert.match(schema, /researchWorkspaces/);
  assert.match(wranglerExample, /"WORKSPACE_SYNC_MODE": "disabled"/);
  assert.doesNotMatch(wranglerExample, /LLM_API_KEY/);
  assert.match(chartView, /FORECAST_STORAGE_KEY/);
  assert.match(chartView, /\{ id: "4H", label: "4小时" \}/);
  assert.match(chartView, /\{ id: "6H", label: "6小时" \}/);
  assert.match(chartView, /showIndicators/);
  assert.match(chartView, /按日期调取推演/);
  assert.match(chartView, /保存并显示图层/);
  assert.match(chartView, /永续合约仓位温度/);
  assert.match(chartView, /去杠杆 \/ 多头平仓/);
  assert.match(chartView, /新空增仓/);
  assert.match(marketChart, /CandlestickSeries/);
  assert.match(marketChart, /attributionLogo: true/);
  assert.match(marketChart, /--chart-color-paper/);
  assert.doesNotMatch(marketChart, /read\("--color-/);
  assert.match(pricingOrder, /SCENARIO PRICING/);
  assert.match(pricingOrder, /等待也是有效决策/);
  assert.match(pricingOrder, /计划会随研究工作区同步/);
  assert.match(pricingOrder, /复制下单清单/);
  assert.match(pricingOrder, /不连接券商，也不发送委托/);
  assert.doesNotMatch(pricingOrder, /券商录入单与成交记录/);
  assert.match(orderMath, /expectedTargetPrice/);
  assert.match(orderMath, /calculateTradeMetrics/);
  assert.match(indicators, /MOMENTUM_THRESHOLD = 0\.6/);
  assert.match(indicators, /HH \+ HL/);
  assert.match(marketRoute, /query1\.finance\.yahoo\.com/);
  assert.match(marketRoute, /api\.nasdaq\.com/);
  assert.match(marketRoute, /api\.finance\.naver\.com/);
  assert.match(marketRoute, /fetchBinanceFuturesMarket/);
  assert.match(binanceMarket, /fapi\.binance\.com/);
  assert.match(binanceMarket, /continuousKlines/);
  assert.match(binanceMarket, /premiumIndex/);
  assert.match(binanceMarket, /openInterestHist/);
  assert.match(binanceMarket, /fundingRate/);
  assert.match(yahooMarket, /fetchYahooIntradayMarket/);
  assert.match(yahooMarket, /aggregateIntradayBars/);
  assert.match(chartView, /fetchBinanceFuturesMarket/);
  assert.match(marketRoute, /SYMBOL_PATTERN/);
  assert.match(researchRoute, /DEEPSEEK_API_KEY/);
  assert.match(researchRoute, /LLM_API_KEY/);
  assert.match(researchRoute, /LLM_BASE_URL/);
  assert.match(researchRoute, /LLM_MODEL/);
  assert.match(researchRoute, /usesDeepSeekExtensions/);
  assert.match(researchRoute, /deepseek-v4-pro/);
  assert.match(researchRoute, /response_format/);
  assert.match(researchRoute, /filingStatus/);
  assert.match(researchRoute, /mapping_unavailable/);
  assert.match(researchRoute, /replace\(\/\^仍需人工核验的缺口/);
  assert.match(secEvidence, /DEFAULT_SEC_USER_AGENT/);
  assert.match(secEvidence, /SEC_CIK_FALLBACK/);
  assert.match(secEvidence, /research@example\.com/);
  assert.match(secEvidence, /data\.sec\.gov/);
  assert.match(researchRoute, /Binance USDⓈ-M Futures/);
  assert.match(researchRoute, /recentNews/);
  assert.match(researchRoute, /changeSummary/);
  assert.match(researchRoute, /confirmed\|invalidated\|open/);
  assert.match(researchRoute, /mode === "refresh"/);
  assert.match(page, /本机保存/);
  assert.match(workspaceRoute, /WORKSPACE_SYNC_MODE/);
  assert.match(workspaceRoute, /syncAvailable: false/);
  assert.doesNotMatch(researchRoute, /sk-[A-Za-z0-9]{16,}/);
  assert.match(data, /symbol: "GOOGL"/);
  assert.match(data, /symbol: "MU"/);
  assert.match(data, /symbol: "ORCL"/);
  assert.match(data, /symbol: "GC=F"/);
  assert.match(data, /symbol: "SI=F"/);
  assert.match(data, /symbol: "CL=F"/);
  assert.match(data, /symbol: "BTC-USD"/);
  assert.match(data, /symbol: "ETH-USD"/);
  assert.match(researchRefresh, /RESEARCH_UPDATES_2026_09_30/);
  assert.match(researchRefresh, /symbol: "BE"/);
  assert.match(researchRefresh, /symbol: "INTC"/);
  assert.match(researchRefresh, /symbol: "TEM"/);
  assert.match(styles, /overflow-x: clip/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /\.forecast-workspace/);
  assert.match(tokens, /Hallmark · macrostructure: Workbench/);
  assert.match(tokens, /--chart-color-paper: #ffffff/);
  assert.match(packageJson, /lightweight-charts/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
