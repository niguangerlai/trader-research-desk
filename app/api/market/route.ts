import {
  fetchBinanceFuturesMarket,
  isBinanceFuturesSymbol,
} from "../../binance-market";
import { aggregateIntradayBars } from "../../chart-data";
import type { ChartTimeframe, MarketBar } from "../../types";

const SYMBOL_PATTERN = /^[A-Z0-9.^=-]{1,20}$/;

type YahooChartPayload = {
  chart?: {
    error?: { description?: string } | null;
    result?: Array<{
      meta?: {
        currency?: string;
        exchangeName?: string;
        instrumentType?: string;
        regularMarketPrice?: number;
      };
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

type NasdaqHistoricalPayload = {
  data?: {
    symbol?: string;
    tradesTable?: {
      rows?: Array<{
        date?: string;
        close?: string;
        volume?: string;
        open?: string;
        high?: string;
        low?: string;
      }>;
    };
  } | null;
  status?: {
    bCodeMessage?: Array<{ errorMessage?: string }>;
  };
};

function parseNasdaqNumber(value: string | undefined) {
  const parsed = Number(String(value ?? "").replace(/[,$]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toIsoDate(value: string | undefined) {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : undefined;
}

async function fetchNasdaqBars(
  symbol: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const endpoint = new URL(
    `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical`,
  );
  endpoint.searchParams.set("assetclass", symbol === "QQQ" ? "etf" : "stocks");
  endpoint.searchParams.set("fromdate", periodStart.toISOString().slice(0, 10));
  endpoint.searchParams.set("todate", periodEnd.toISOString().slice(0, 10));
  endpoint.searchParams.set("limit", "5000");

  const upstream = await fetch(endpoint, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Origin: "https://www.nasdaq.com",
      Referer: "https://www.nasdaq.com/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
    },
  });
  if (!upstream.ok) throw new Error(`Nasdaq 行情源返回 ${upstream.status}。`);

  const payload = (await upstream.json()) as NasdaqHistoricalPayload;
  const rows = payload.data?.tradesTable?.rows ?? [];
  const bars = rows.flatMap((row): MarketBar[] => {
    const time = toIsoDate(row.date);
    const open = parseNasdaqNumber(row.open);
    const high = parseNasdaqNumber(row.high);
    const low = parseNasdaqNumber(row.low);
    const close = parseNasdaqNumber(row.close);
    const volume = parseNasdaqNumber(row.volume);
    return time &&
      open !== undefined &&
      high !== undefined &&
      low !== undefined &&
      close !== undefined
      ? [{ time, open, high, low, close, volume: volume ?? 0 }]
      : [];
  });

  if (!bars.length) {
    const message = payload.status?.bCodeMessage?.[0]?.errorMessage;
    throw new Error(message || "Nasdaq 没有返回该标的的历史行情。");
  }

  return {
    bars: bars.sort((a, b) => a.time.localeCompare(b.time)),
    source: "Nasdaq Historical",
  };
}

async function fetchYahooBars(
  symbol: string,
  periodStart: Date,
  periodEnd: Date,
  timeframe: ChartTimeframe,
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
  const intraday = timeframe === "4H" || timeframe === "6H";
  endpoint.searchParams.set("interval", intraday ? "60m" : "1d");
  endpoint.searchParams.set("includePrePost", "false");
  endpoint.searchParams.set("events", "div,splits");

  const upstream = await fetch(endpoint, {
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
    },
  });
  if (!upstream.ok) throw new Error(`Yahoo 行情源返回 ${upstream.status}。`);

  const payload = (await upstream.json()) as YahooChartPayload;
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp ?? [];
  if (!result || !quote || payload.chart?.error) {
    throw new Error(
      payload.chart?.error?.description ?? "没有找到该标的的行情。",
    );
  }

  const rawBars: MarketBar[] = timestamps.flatMap((timestamp, index) => {
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
            time: intraday
              ? timestamp
              : new Date(timestamp * 1000).toISOString().slice(0, 10),
            open,
            high,
            low,
            close,
            volume: typeof volume === "number" ? volume : 0,
          },
        ]
      : [];
  });
  const bars = intraday
    ? aggregateIntradayBars(rawBars, timeframe === "4H" ? 4 : 6)
    : rawBars;
  if (!bars.length) throw new Error("Yahoo 没有返回可用K线。");
  return {
    bars,
    source: intraday
      ? `Yahoo Finance · ${timeframe}（60分钟聚合）`
      : "Yahoo Finance",
  };
}

async function fetchNaverBars(
  symbol: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const koreanSymbol = symbol.replace(/\.KS$/, "");
  const endpoint = new URL("https://api.finance.naver.com/siseJson.naver");
  endpoint.searchParams.set("symbol", koreanSymbol);
  endpoint.searchParams.set("requestType", "1");
  endpoint.searchParams.set(
    "startTime",
    periodStart.toISOString().slice(0, 10).replaceAll("-", ""),
  );
  endpoint.searchParams.set(
    "endTime",
    periodEnd.toISOString().slice(0, 10).replaceAll("-", ""),
  );
  endpoint.searchParams.set("timeframe", "day");

  const upstream = await fetch(endpoint, {
    headers: { "User-Agent": "Mozilla/5.0 Trader Research Desk/1.0" },
  });
  if (!upstream.ok) throw new Error(`Naver 行情源返回 ${upstream.status}。`);
  const body = await upstream.text();
  const rowPattern =
    /\["(\d{8})",\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/g;
  const bars: MarketBar[] = [];

  for (const match of body.matchAll(rowPattern)) {
    bars.push({
      time: `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}`,
      open: Number(match[2]),
      high: Number(match[3]),
      low: Number(match[4]),
      close: Number(match[5]),
      volume: Number(match[6]),
    });
  }

  if (!bars.length) throw new Error("Naver 没有返回可用K线。");
  return { bars, source: "Naver Finance" };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const symbol = requestUrl.searchParams.get("symbol")?.trim().toUpperCase();
  const requestedTimeframe =
    requestUrl.searchParams.get("timeframe")?.trim().toUpperCase() ?? "1D";
  const timeframe: ChartTimeframe =
    requestedTimeframe === "4H" || requestedTimeframe === "6H"
      ? requestedTimeframe
      : "1D";

  if (!symbol || !SYMBOL_PATTERN.test(symbol)) {
    return Response.json(
      { error: "行情代码格式无效。" },
      { status: 400 },
    );
  }

  const periodEnd = new Date();
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
  const periodStart = new Date(periodEnd);
  if (timeframe === "4H" || timeframe === "6H") {
    periodStart.setUTCDate(periodStart.getUTCDate() - 729);
  } else {
    periodStart.setUTCFullYear(periodStart.getUTCFullYear() - 2);
  }

  try {
    const marketData = isBinanceFuturesSymbol(symbol)
      ? await fetchBinanceFuturesMarket(
          symbol,
          periodStart,
          periodEnd,
          timeframe,
        )
      : symbol.endsWith(".KS")
        ? timeframe === "1D"
          ? await fetchNaverBars(symbol, periodStart, periodEnd).catch(() =>
              fetchYahooBars(symbol, periodStart, periodEnd, timeframe),
            )
          : await fetchYahooBars(symbol, periodStart, periodEnd, timeframe)
        : timeframe === "1D"
          ? await fetchNasdaqBars(symbol, periodStart, periodEnd).catch(() =>
              fetchYahooBars(symbol, periodStart, periodEnd, timeframe),
            )
          : await fetchYahooBars(symbol, periodStart, periodEnd, timeframe);

    return Response.json(
      {
        symbol,
        timeframe,
        bars: marketData.bars,
        source: marketData.source,
        derivatives:
          "derivatives" in marketData ? marketData.derivatives : undefined,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=900",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "当前无法连接行情源，请稍后重试。" },
      { status: 502 },
    );
  }
}
