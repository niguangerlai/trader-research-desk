import { aggregateIntradayBars } from "./chart-data";
import type { ChartTimeframe, MarketBar } from "./types";

type YahooChartPayload = {
  chart?: {
    error?: { description?: string } | null;
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

export async function fetchYahooIntradayMarket(
  symbol: string,
  periodStart: Date,
  periodEnd: Date,
  timeframe: Extract<ChartTimeframe, "4H" | "6H">,
  signal?: AbortSignal,
) {
  const endpoint = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
  );
  endpoint.searchParams.set(
    "period1",
    Math.floor(periodStart.getTime() / 1000).toString(),
  );
  endpoint.searchParams.set(
    "period2",
    Math.floor(periodEnd.getTime() / 1000).toString(),
  );
  endpoint.searchParams.set("interval", "60m");
  endpoint.searchParams.set("includePrePost", "false");
  endpoint.searchParams.set("events", "div,splits");

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json,text/plain,*/*" },
    signal: signal ?? AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Yahoo 行情源返回 ${response.status}。`);
  }

  const payload = (await response.json()) as YahooChartPayload;
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result || !quote || payload.chart?.error) {
    throw new Error(
      payload.chart?.error?.description ?? "没有找到该标的的分时行情。",
    );
  }

  const rawBars: MarketBar[] = (result.timestamp ?? []).flatMap(
    (timestamp, index) => {
      const open = quote.open?.[index];
      const high = quote.high?.[index];
      const low = quote.low?.[index];
      const close = quote.close?.[index];
      const volume = quote.volume?.[index];
      return typeof open === "number" &&
        typeof high === "number" &&
        typeof low === "number" &&
        typeof close === "number"
        ? [
            {
              time: timestamp,
              open,
              high,
              low,
              close,
              volume: typeof volume === "number" ? volume : 0,
            },
          ]
        : [];
    },
  );
  const bars = aggregateIntradayBars(
    rawBars,
    timeframe === "4H" ? 4 : 6,
  );
  if (!bars.length) throw new Error("Yahoo 没有返回可用分时K线。");

  return {
    bars,
    source: `Yahoo Finance · ${timeframe}（浏览器直连，60分钟聚合）`,
    fetchedAt: new Date().toISOString(),
  };
}

