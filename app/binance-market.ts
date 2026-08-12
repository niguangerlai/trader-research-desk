import type { ChartTimeframe, MarketBar } from "./types";

const BINANCE_FUTURES_SYMBOLS: Record<string, string> = {
  "BTC-USD": "BTCUSDT",
  "ETH-USD": "ETHUSDT",
  BTCUSDT: "BTCUSDT",
  ETHUSDT: "ETHUSDT",
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  ...unknown[],
];

type BinancePremiumIndex = {
  markPrice?: string;
  indexPrice?: string;
  lastFundingRate?: string;
  nextFundingTime?: number;
  time?: number;
};

type BinanceOpenInterest = {
  openInterest?: string;
};

type BinanceFundingRecord = {
  fundingRate?: string;
};

type BinanceOpenInterestRecord = {
  sumOpenInterest?: string;
};

export type DerivativesSnapshot = {
  contract: string;
  markPrice?: number;
  indexPrice?: number;
  basisPercent?: number;
  fundingRatePercent?: number;
  averageFundingRate3dPercent?: number;
  nextFundingTime?: string;
  openInterest?: number;
  openInterestNotional?: number;
  openInterestChange7dPercent?: number;
  snapshotTime?: string;
};

export type BinanceFuturesMarket = {
  bars: MarketBar[];
  source: string;
  derivatives: DerivativesSnapshot;
  fetchedAt: string;
};

export function isBinanceFuturesSymbol(symbol: string) {
  return Boolean(BINANCE_FUTURES_SYMBOLS[symbol]);
}

function requestSignal(signal?: AbortSignal) {
  return signal ?? AbortSignal.timeout(15_000);
}

const BINANCE_INTERVALS: Record<ChartTimeframe, string> = {
  "4H": "4h",
  "6H": "6h",
  "1D": "1d",
  "1W": "1d",
};

const INTERVAL_MILLISECONDS: Record<string, number> = {
  "4h": 4 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

async function fetchKlinePages(
  contract: string,
  timeframe: ChartTimeframe,
  periodStart: Date,
  periodEnd: Date,
  requestInit: RequestInit,
) {
  const interval = BINANCE_INTERVALS[timeframe];
  const intervalMilliseconds = INTERVAL_MILLISECONDS[interval];
  const rows: BinanceKline[] = [];
  let cursor = periodStart.getTime();

  for (let page = 0; page < 6 && cursor < periodEnd.getTime(); page += 1) {
    const endpoint = new URL(
      "https://fapi.binance.com/fapi/v1/continuousKlines",
    );
    endpoint.searchParams.set("pair", contract);
    endpoint.searchParams.set("contractType", "PERPETUAL");
    endpoint.searchParams.set("interval", interval);
    endpoint.searchParams.set("startTime", cursor.toString());
    endpoint.searchParams.set("endTime", periodEnd.getTime().toString());
    endpoint.searchParams.set("limit", "1000");

    const response = await fetch(endpoint, requestInit);
    if (!response.ok) {
      throw new Error(`Binance Futures 行情源返回 ${response.status}。`);
    }
    const pageRows = (await response.json()) as BinanceKline[];
    if (!pageRows.length) break;
    rows.push(...pageRows);

    const nextCursor = pageRows.at(-1)![0] + intervalMilliseconds;
    if (nextCursor <= cursor) break;
    cursor = nextCursor;
    if (pageRows.length < 1000) break;
  }

  return rows;
}

export async function fetchBinanceFuturesMarket(
  symbol: string,
  periodStart: Date,
  periodEnd: Date,
  timeframe: ChartTimeframe = "1D",
  signal?: AbortSignal,
): Promise<BinanceFuturesMarket> {
  const contract = BINANCE_FUTURES_SYMBOLS[symbol];
  if (!contract) throw new Error("未配置对应的币安永续合约。");

  const premiumEndpoint = new URL(
    "https://fapi.binance.com/fapi/v1/premiumIndex",
  );
  premiumEndpoint.searchParams.set("symbol", contract);

  const openInterestEndpoint = new URL(
    "https://fapi.binance.com/fapi/v1/openInterest",
  );
  openInterestEndpoint.searchParams.set("symbol", contract);

  const fundingEndpoint = new URL(
    "https://fapi.binance.com/fapi/v1/fundingRate",
  );
  fundingEndpoint.searchParams.set("symbol", contract);
  fundingEndpoint.searchParams.set("limit", "9");

  const openInterestHistoryEndpoint = new URL(
    "https://fapi.binance.com/futures/data/openInterestHist",
  );
  openInterestHistoryEndpoint.searchParams.set("symbol", contract);
  openInterestHistoryEndpoint.searchParams.set("period", "1d");
  openInterestHistoryEndpoint.searchParams.set("limit", "8");

  const requestInit = {
    headers: { Accept: "application/json" },
    signal: requestSignal(signal),
  };
  const [
    klineResult,
    premiumResult,
    openInterestResult,
    fundingResult,
    oiHistoryResult,
  ] = await Promise.allSettled([
    fetchKlinePages(
      contract,
      timeframe,
      periodStart,
      periodEnd,
      requestInit,
    ),
    fetch(premiumEndpoint, requestInit),
    fetch(openInterestEndpoint, requestInit),
    fetch(fundingEndpoint, requestInit),
    fetch(openInterestHistoryEndpoint, requestInit),
  ]);

  if (klineResult.status !== "fulfilled") {
    throw new Error("Binance Futures 行情请求失败。");
  }

  const payload = klineResult.value;
  const bars = payload.flatMap((row): MarketBar[] => {
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[5]);
    return Number.isFinite(open) &&
      Number.isFinite(high) &&
      Number.isFinite(low) &&
      Number.isFinite(close)
      ? [
          {
            time:
              timeframe === "1D" || timeframe === "1W"
                ? new Date(row[0]).toISOString().slice(0, 10)
                : Math.floor(row[0] / 1000),
            open,
            high,
            low,
            close,
            volume: Number.isFinite(volume) ? volume : 0,
          },
        ]
      : [];
  });
  if (!bars.length) throw new Error("Binance Futures 没有返回可用K线。");

  const premium =
    premiumResult.status === "fulfilled" && premiumResult.value.ok
      ? ((await premiumResult.value.json()) as BinancePremiumIndex)
      : undefined;
  const openInterest =
    openInterestResult.status === "fulfilled" && openInterestResult.value.ok
      ? ((await openInterestResult.value.json()) as BinanceOpenInterest)
      : undefined;
  const fundingHistory =
    fundingResult.status === "fulfilled" && fundingResult.value.ok
      ? ((await fundingResult.value.json()) as BinanceFundingRecord[])
      : [];
  const openInterestHistory =
    oiHistoryResult.status === "fulfilled" && oiHistoryResult.value.ok
      ? ((await oiHistoryResult.value.json()) as BinanceOpenInterestRecord[])
      : [];

  const markPrice = Number(premium?.markPrice);
  const indexPrice = Number(premium?.indexPrice);
  const fundingRate = Number(premium?.lastFundingRate);
  const currentOpenInterest = Number(openInterest?.openInterest);
  const fundingRates = fundingHistory
    .map((record) => Number(record.fundingRate))
    .filter(Number.isFinite);
  const oldestOpenInterest = Number(openInterestHistory[0]?.sumOpenInterest);
  const latestOpenInterest = Number(
    openInterestHistory.at(-1)?.sumOpenInterest,
  );

  return {
    bars,
    source: `Binance USDⓈ-M Futures · ${contract} PERPETUAL · ${BINANCE_INTERVALS[timeframe]}`,
    fetchedAt: new Date().toISOString(),
    derivatives: {
      contract,
      markPrice: Number.isFinite(markPrice) ? markPrice : undefined,
      indexPrice: Number.isFinite(indexPrice) ? indexPrice : undefined,
      basisPercent:
        Number.isFinite(markPrice) &&
        Number.isFinite(indexPrice) &&
        indexPrice !== 0
          ? ((markPrice - indexPrice) / indexPrice) * 100
          : undefined,
      fundingRatePercent: Number.isFinite(fundingRate)
        ? fundingRate * 100
        : undefined,
      averageFundingRate3dPercent: fundingRates.length
        ? (fundingRates.reduce((sum, rate) => sum + rate, 0) /
            fundingRates.length) *
          100
        : undefined,
      nextFundingTime: premium?.nextFundingTime
        ? new Date(premium.nextFundingTime).toISOString()
        : undefined,
      openInterest: Number.isFinite(currentOpenInterest)
        ? currentOpenInterest
        : undefined,
      openInterestNotional:
        Number.isFinite(currentOpenInterest) && Number.isFinite(markPrice)
          ? currentOpenInterest * markPrice
          : undefined,
      openInterestChange7dPercent:
        Number.isFinite(oldestOpenInterest) &&
        Number.isFinite(latestOpenInterest) &&
        oldestOpenInterest !== 0
          ? ((latestOpenInterest - oldestOpenInterest) /
              oldestOpenInterest) *
            100
          : undefined,
      snapshotTime: premium?.time
        ? new Date(premium.time).toISOString()
        : undefined,
    },
  };
}
