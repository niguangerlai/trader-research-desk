import type { WeeklyCandle } from "./weekly-screen";

export type ListedSecurity = {
  symbol: string;
  name: string;
  exchange: string;
  kind: "stock" | "etf" | "other";
  price?: number;
  volume?: number;
  marketCap?: number;
  binanceSymbol?: string;
  mappingStatus?: "verified" | "unresolved";
};
export type DiscoveryStatus = "pending" | "prefiltered" | "matched" | "rejected" | "unavailable";
export type DiscoveryResult = {
  symbol: string;
  status: Exclude<DiscoveryStatus, "pending">;
  weeks: WeeklyCandle[];
  source: string;
  fetchedAt: string;
  reason?: string;
};
export type DiscoverySnapshot = {
  periodKey: string;
  weekStarts: string[];
  universe: ListedSecurity[];
  results: Record<string, DiscoveryResult>;
  directoryAsOf: string;
  fetchedAt: string;
  source: string;
  warnings: string[];
  cache: "persistent" | "session";
  scope?: { listedTotal: number; binanceEquitiesTotal: number; mappedTotal: number; unresolved: string[] };
  binanceMetadata?: BinanceBrowserMetadata;
};
export type BinanceListedContract = {
  symbol: string;
  status: string;
  contractType: string;
  underlyingType: string;
  baseAsset: string;
  quoteAsset?: string;
};
export type BinanceBrowserMetadata = {
  contracts: BinanceListedContract[];
  prices: Array<{ symbol: string; price: number }>;
  fetchedAt: string;
};

export function isBinanceBrowserMetadata(value: unknown): value is BinanceBrowserMetadata {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BinanceBrowserMetadata>;
  return typeof item.fetchedAt === "string" && Number.isFinite(Date.parse(item.fetchedAt)) &&
    Date.now() - Date.parse(item.fetchedAt) < 10 * 60_000 && Date.parse(item.fetchedAt) <= Date.now() + 60_000 &&
    Array.isArray(item.contracts) && item.contracts.length > 0 && item.contracts.length <= 1500 &&
    item.contracts.every((contract) => contract && typeof contract.symbol === "string" && /^[A-Z0-9.-]{1,30}$/.test(contract.symbol) &&
      typeof contract.baseAsset === "string" && /^[A-Z0-9.-]{1,30}$/.test(contract.baseAsset) &&
      typeof contract.status === "string" && typeof contract.contractType === "string" && contract.underlyingType === "EQUITY") &&
    Array.isArray(item.prices) && item.prices.length <= 1500 && item.prices.every((quote) =>
      quote && typeof quote.symbol === "string" && typeof quote.price === "number" && Number.isFinite(quote.price) && quote.price > 0);
}

export function binanceTradableEquityUniverse(securities: ListedSecurity[], contracts: BinanceListedContract[]) {
  const exact = new Map(securities.map((item) => [normalizeListingSymbol(item.symbol), item]));
  const compact = new Map<string, ListedSecurity[]>();
  for (const security of securities) {
    const key = security.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
    compact.set(key, [...(compact.get(key) ?? []), security]);
  }
  const active = contracts.filter((item) => item.status === "TRADING" &&
    item.contractType === "TRADIFI_PERPETUAL" && item.underlyingType === "EQUITY");
  const mapped = new Map<string, ListedSecurity>();
  const unresolved: string[] = [];
  for (const contract of active) {
    const ticker = contract.baseAsset.toUpperCase();
    const compactMatches = compact.get(ticker.replace(/[^A-Z0-9]/g, ""));
    const listing = exact.get(normalizeListingSymbol(ticker)) ?? (compactMatches?.length === 1 ? compactMatches[0] : undefined);
    if (!listing) unresolved.push(contract.symbol);
    const security: ListedSecurity = listing
      ? { ...listing, binanceSymbol: contract.symbol, mappingStatus: "verified" }
      : { symbol: ticker, name: `${ticker} · 对应挂牌代码待核验`, exchange: "待核验", kind: "other", binanceSymbol: contract.symbol, mappingStatus: "unresolved" };
    // Prefer USDT when one underlying has several active quote-asset contracts.
    if (!mapped.has(security.symbol) || contract.quoteAsset === "USDT") mapped.set(security.symbol, security);
  }
  const universe = Array.from(mapped.values()).sort((left, right) => left.symbol.localeCompare(right.symbol));
  return { universe, scope: { listedTotal: securities.length, binanceEquitiesTotal: active.length,
    mappedTotal: universe.filter((item) => item.mappingStatus === "verified").length, unresolved } };
}

function kindOf(name: string, etf: string): ListedSecurity["kind"] {
  if (etf === "Y") return "etf";
  return /\b(?:warrants?|rights?|units?|preferred|depositary shares|notes?|debentures)\b/i.test(name) &&
    !/American Depositary/i.test(name) ? "other" : "stock";
}

export function parseSymbolDirectory(body: string, nasdaq: boolean) {
  const lines = body.trim().split(/\r?\n/);
  const headers = lines[0]?.split("|") ?? [];
  const required = nasdaq ? "Symbol" : "ACT Symbol";
  if (!headers.includes(required) || !headers.includes("Test Issue")) {
    throw new Error("上市名录格式发生变化，不能确认全市场覆盖。");
  }
  const exchangeNames: Record<string, string> = {
    N: "NYSE", A: "NYSE American", P: "NYSE Arca", Z: "Cboe BZX", V: "IEX",
  };
  const securities: ListedSecurity[] = [];
  let asOf = "";
  for (const line of lines.slice(1)) {
    if (line.startsWith("File Creation Time:")) {
      asOf = line.split("|")[0].replace("File Creation Time:", "").trim();
      continue;
    }
    const cells = line.split("|");
    const row = Object.fromEntries(headers.map((key, index) => [key, cells[index] ?? ""]));
    if (row["Test Issue"] !== "N" || !row[required] || !row["Security Name"]) continue;
    securities.push({
      symbol: row[required].trim(), name: row["Security Name"].trim(),
      exchange: nasdaq ? "NASDAQ" : exchangeNames[row.Exchange] || row.Exchange || "US",
      kind: kindOf(row["Security Name"], row.ETF),
    });
  }
  if (!securities.length) throw new Error("上市名录为空，无法启动扫描。");
  return { securities, asOf };
}

export function normalizeListingSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/[-./]/g, ".");
}

export function discoveryCounts(snapshot: DiscoverySnapshot) {
  const statuses = snapshot.universe.map((item) => snapshot.results[item.symbol]?.status ?? "pending");
  const count = (status: DiscoveryStatus) => statuses.filter((item) => item === status).length;
  return {
    total: statuses.length, pending: count("pending"), matched: count("matched"),
    prefiltered: count("prefiltered"), rejected: count("rejected"), unavailable: count("unavailable"),
  };
}
