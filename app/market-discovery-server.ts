import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { marketDiscoveryCache } from "../db/schema";
import { evaluateTwoCompletedBullishWeeks, completedWeekStarts } from "./weekly-screen";
import {
  binanceTradableEquityUniverse, parseSymbolDirectory,
  type DiscoverySnapshot, type DiscoveryResult, type ListedSecurity, type BinanceListedContract, type BinanceBrowserMetadata,
} from "./market-discovery";
import type { MarketBar } from "./types";

const DIRECTORY_ROOT = "https://www.nasdaqtrader.com/dynamic/SymDir/";
let universeCache: { key: string; expires: number; snapshot: DiscoverySnapshot } | null = null;
let loadingUniverse: Promise<DiscoverySnapshot> | null = null;
const sessionResults = new Map<string, DiscoveryResult>();

async function getJson(url: URL | string, options: RequestInit = {}) {
  const response = await fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`行情源返回 ${response.status}`);
  return response.json();
}

async function getDirectory(filename: string, nasdaq: boolean) {
  const response = await fetch(`${DIRECTORY_ROOT}${filename}`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`美国上市名录读取失败（${response.status}）。`);
  return parseSymbolDirectory(await response.text(), nasdaq);
}

async function loadUniverse(browserMetadata?: BinanceBrowserMetadata): Promise<DiscoverySnapshot> {
  const asOf = new Date();
  const weekStarts = completedWeekStarts(asOf);
  const periodKey = weekStarts.join(":");
  const [nasdaq, other, binance] = await Promise.all([
    getDirectory("nasdaqlisted.txt", true), getDirectory("otherlisted.txt", false),
    browserMetadata ? Promise.resolve({ symbols: browserMetadata.contracts }) : getJson("https://fapi.binance.com/fapi/v1/exchangeInfo", { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6_000) })
      .catch((error) => { throw new Error(`币安合约名录连接失败：${error instanceof Error ? error.message : "请求失败"}`); }) as Promise<{ symbols?: BinanceListedContract[] }>,
  ]);
  const securities = Array.from(new Map(
    [...nasdaq.securities, ...other.securities].map((item) => [item.symbol, item]),
  ).values()).sort((left, right) => left.symbol.localeCompare(right.symbol));
  if (!Array.isArray(binance.symbols) || !binance.symbols.length) {
    throw new Error("币安交易产品名录不可用，无法确认初筛范围。");
  }
  const filtered = binanceTradableEquityUniverse(securities, binance.symbols);
  let universe = filtered.universe;
  if (!universe.length) throw new Error("币安当前未返回可交易的美股类合约。");
  const results: Record<string, DiscoveryResult> = {};
  const warnings: string[] = [];
  try {
    const prices = browserMetadata ? browserMetadata.prices : await getJson("https://fapi.binance.com/fapi/v2/ticker/price") as Array<{ symbol: string; price: string }>;
    const byContract = new Map(prices.map((item) => [item.symbol, Number(item.price)]));
    universe = universe.map((item) => ({ ...item, price: item.binanceSymbol ? byContract.get(item.binanceSymbol) : undefined }));
  } catch {
    warnings.push("币安最新报价暂不可用；周线复核仍按正股历史K线继续。");
  }
  for (const security of universe.filter((item) => item.mappingStatus === "unresolved")) {
    results[security.symbol] = { symbol: security.symbol, status: "unavailable", weeks: [],
      source: "Binance exchangeInfo / Nasdaq Trader", fetchedAt: asOf.toISOString(),
      reason: "币安产品正在交易，但未能唯一确认对应美国挂牌代码。" };
  }
  return {
    periodKey, weekStarts, universe, results, scope: filtered.scope,
    directoryAsOf: `Nasdaq ${nasdaq.asOf} · Other ${other.asOf}`,
    fetchedAt: asOf.toISOString(), source: `Binance exchangeInfo${browserMetadata ? "（浏览器直连）" : ""} · Nasdaq Trader`,
    binanceMetadata: browserMetadata,
    warnings, cache: "session",
  };
}

async function universeSnapshot(browserMetadata?: BinanceBrowserMetadata) {
  if (browserMetadata) return loadUniverse(browserMetadata);
  const key = completedWeekStarts().join(":");
  if (universeCache?.key === key && universeCache.expires > Date.now()) return universeCache.snapshot;
  if (!loadingUniverse) {
    loadingUniverse = loadUniverse().then((snapshot) => {
      universeCache = { key: snapshot.periodKey, expires: Date.now() + 5 * 60_000, snapshot };
      return snapshot;
    }).finally(() => { loadingUniverse = null; });
  }
  return loadingUniverse;
}

async function readCache(periodKey: string, symbols?: string[]) {
  const results: Record<string, DiscoveryResult> = {};
  for (const [key, result] of sessionResults) {
    if (key.startsWith(`${periodKey}|`) && (!symbols || symbols.includes(result.symbol))) results[result.symbol] = result;
  }
  try {
    const db = await getDb();
    const rows = await db.select().from(marketDiscoveryCache)
      .where(symbols ? and(eq(marketDiscoveryCache.periodKey, periodKey), inArray(marketDiscoveryCache.symbol, symbols))
        : eq(marketDiscoveryCache.periodKey, periodKey));
    for (const row of rows) {
      try { results[row.symbol] = JSON.parse(row.payload) as DiscoveryResult; } catch { /* Re-fetch corrupt cache entries. */ }
    }
    return { results, persistent: true };
  } catch {
    return { results, persistent: false };
  }
}

export async function getDiscoverySnapshot(browserMetadata?: BinanceBrowserMetadata): Promise<DiscoverySnapshot> {
  const snapshot = await universeSnapshot(browserMetadata);
  const cached = await readCache(snapshot.periodKey);
  const allowed = new Set(snapshot.universe.map((item) => item.symbol));
  const cacheResults = Object.fromEntries(Object.entries(cached.results).filter(([symbol]) => allowed.has(symbol)));
  return { ...snapshot, results: { ...cacheResults, ...snapshot.results }, cache: cached.persistent ? "persistent" : "session" };
}

function numberValue(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[,$]/g, ""));
  return value !== null && value !== undefined && String(value).trim() && Number.isFinite(parsed) ? parsed : undefined;
}

async function nasdaqHistory(security: ListedSecurity, weekStarts: string[]) {
  const endpoint = new URL(`https://api.nasdaq.com/api/quote/${encodeURIComponent(security.symbol)}/historical`);
  endpoint.searchParams.set("assetclass", security.kind === "etf" ? "etf" : "stocks");
  endpoint.searchParams.set("fromdate", weekStarts[0]);
  const end = new Date(`${weekStarts[1]}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  endpoint.searchParams.set("todate", end.toISOString().slice(0, 10));
  endpoint.searchParams.set("limit", "30");
  const payload = await getJson(endpoint, { headers: {
    Accept: "application/json,text/plain,*/*", Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
  } }) as { data?: { tradesTable?: { rows?: Array<Record<string, string>> } } };
  const bars: MarketBar[] = [];
  for (const row of payload.data?.tradesTable?.rows ?? []) {
    const match = row.date?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const open = numberValue(row.open); const close = numberValue(row.close);
    if (!match || open === undefined || close === undefined) continue;
    bars.push({ time: `${match[3]}-${match[1]}-${match[2]}`, open, close,
      high: numberValue(row.high) ?? Math.max(open, close),
      low: numberValue(row.low) ?? Math.min(open, close), volume: numberValue(row.volume) ?? 0 });
  }
  if (!bars.length) throw new Error("Nasdaq 无可用历史K线");
  return { bars, source: "Nasdaq Historical · daily OHLC" };
}

async function yahooHistory(security: ListedSecurity, weekStarts: string[]) {
  const symbol = security.symbol.replace(/\./g, "-");
  const endpoint = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  endpoint.searchParams.set("interval", "1d");
  endpoint.searchParams.set("period1", String(Date.parse(`${weekStarts[0]}T00:00:00Z`) / 1_000));
  const end = new Date(`${weekStarts[1]}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 7);
  endpoint.searchParams.set("period2", String(end.getTime() / 1_000));
  const payload = await getJson(endpoint, { headers: { "User-Agent": "Mozilla/5.0" } }) as {
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{
      open?: Array<number | null>; close?: Array<number | null>;
      high?: Array<number | null>; low?: Array<number | null>; volume?: Array<number | null>;
    }> } }> };
  };
  const result = payload.chart?.result?.[0]; const quote = result?.indicators?.quote?.[0];
  const bars: MarketBar[] = (result?.timestamp ?? []).flatMap((timestamp, index) => {
    const open = quote?.open?.[index]; const close = quote?.close?.[index];
    return typeof open === "number" && typeof close === "number" ? [{
      time: new Date(timestamp * 1_000).toISOString().slice(0, 10), open, close,
      high: quote?.high?.[index] ?? Math.max(open, close), low: quote?.low?.[index] ?? Math.min(open, close),
      volume: quote?.volume?.[index] ?? 0,
    }] : [];
  });
  if (!bars.length) throw new Error("Yahoo 无可用历史K线");
  return { bars, source: "Yahoo Finance · daily OHLC" };
}

async function verifySecurity(security: ListedSecurity, snapshot: DiscoverySnapshot): Promise<DiscoveryResult> {
  if (security.mappingStatus === "unresolved") return snapshot.results[security.symbol];
  try {
    const history = await nasdaqHistory(security, snapshot.weekStarts)
      .catch(() => yahooHistory(security, snapshot.weekStarts));
    const result = evaluateTwoCompletedBullishWeeks(history.bars);
    const missing = ["insufficient_data", "week_gap", "stale_data"].includes(result.reason);
    return { symbol: security.symbol, status: result.matched ? "matched" : missing ? "unavailable" : "rejected",
      weeks: result.weeks, source: history.source, fetchedAt: new Date().toISOString(),
      reason: missing ? "最近两个完整周的K线不足，无法确认。" : undefined };
  } catch (error) {
    return { symbol: security.symbol, status: "unavailable", weeks: [], source: "Nasdaq / Yahoo",
      fetchedAt: new Date().toISOString(), reason: error instanceof Error ? error.message : "行情读取失败" };
  }
}

export async function scanDiscoveryBatch(periodKey: string, symbols: string[], retry = false, browserMetadata?: BinanceBrowserMetadata) {
  const base = await universeSnapshot(browserMetadata);
  const cachedEntries = await readCache(periodKey, symbols);
  const snapshot = { ...base, results: { ...cachedEntries.results, ...base.results } };
  if (periodKey !== snapshot.periodKey) throw new Error("扫描周已变化，请刷新全市场名录后继续。");
  const bySymbol = new Map(snapshot.universe.map((item) => [item.symbol, item]));
  if (symbols.some((symbol) => !bySymbol.has(symbol))) throw new Error("请求包含不在美国上市名录中的标的。");
  const targets = [...new Set(symbols)].map((symbol) => bySymbol.get(symbol)!);
  const results: DiscoveryResult[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, targets.length) }, async () => {
    while (next < targets.length) {
      const security = targets[next++];
      const cached = snapshot.results[security.symbol];
      results.push(cached && !(retry && cached.status === "unavailable") ? cached : await verifySecurity(security, snapshot));
    }
  }));
  for (const result of results) sessionResults.set(`${periodKey}|${result.symbol}`, result);
  let persistent = false;
  try {
    const db = await getDb();
    if (results.length) await db.insert(marketDiscoveryCache).values(results.map((result) => ({
      id: `${periodKey}|${result.symbol}`, periodKey, symbol: result.symbol,
      payload: JSON.stringify(result), updatedAt: result.fetchedAt,
    }))).onConflictDoUpdate({ target: marketDiscoveryCache.id,
      set: { payload: sql`excluded.payload`, updatedAt: sql`excluded.updated_at` } });
    persistent = true;
  } catch { /* Local deployments without D1 retain an in-session cache. */ }
  return { periodKey, results, cache: persistent ? "persistent" : "session" };
}
