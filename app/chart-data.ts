import type {
  ChartRange,
  ForecastRecord,
  MarketBar,
  MarketTime,
} from "./types";

export const FORECAST_STORAGE_KEY = "trader-research-forecasts:v1";

export const DEFAULT_QQQ_FORECASTS: ForecastRecord[] = [
  {
    id: "qqq-2026-07-22",
    symbol: "QQQ",
    asOfDate: "2026-07-22",
    title: "中级调整，等待方向确认",
    bias: "neutral",
    narrative:
      "长期上升趋势尚未失效，但短线仍处于20日与50日均线下方。区间中部不抢方向，先看价格能否修复关键均线。",
    confirmation: "收盘重新站稳719，并在随后交易日保留涨幅。",
    invalidation: "放量跌破686.76且无法在两个交易日内快速收回。",
    triggerPrice: 719,
    invalidationPrice: 686.76,
    path: [],
    createdAt: "2026-07-22T16:00:00+08:00",
    updatedAt: "2026-07-22T16:00:00+08:00",
  },
];

export function resolveMarketSymbol(symbol: string, market: string) {
  const normalized = symbol.trim().toUpperCase();
  if (market.toUpperCase() === "KRX" && /^\d{6}$/.test(normalized)) {
    return `${normalized}.KS`;
  }
  return normalized;
}

export function aggregateWeeklyBars(bars: MarketBar[]) {
  const weeks = new Map<string, MarketBar>();

  for (const bar of bars) {
    const date =
      typeof bar.time === "number"
        ? new Date(bar.time * 1000)
        : new Date(`${bar.time}T00:00:00Z`);
    const weekday = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - weekday + 1);
    const weekKey = date.toISOString().slice(0, 10);
    const current = weeks.get(weekKey);

    if (!current) {
      weeks.set(weekKey, { ...bar, time: weekKey });
      continue;
    }

    weeks.set(weekKey, {
      time: weekKey,
      open: current.open,
      high: Math.max(current.high, bar.high),
      low: Math.min(current.low, bar.low),
      close: bar.close,
      volume: current.volume + bar.volume,
    });
  }

  return Array.from(weeks.values()).sort((a, b) =>
    a.time.localeCompare(b.time),
  );
}

export function aggregateIntradayBars(bars: MarketBar[], hours: 4 | 6) {
  const bySession = new Map<string, MarketBar[]>();
  for (const bar of bars) {
    if (typeof bar.time !== "number") continue;
    const session = new Date(bar.time * 1000).toISOString().slice(0, 10);
    const current = bySession.get(session) ?? [];
    current.push(bar);
    bySession.set(session, current);
  }

  const aggregated: MarketBar[] = [];
  for (const sessionBars of bySession.values()) {
    sessionBars.sort((a, b) => Number(a.time) - Number(b.time));
    for (let index = 0; index < sessionBars.length; index += hours) {
      const group = sessionBars.slice(index, index + hours);
      const first = group[0];
      const last = group.at(-1);
      if (!first || !last) continue;
      aggregated.push({
        time: first.time,
        open: first.open,
        high: Math.max(...group.map((bar) => bar.high)),
        low: Math.min(...group.map((bar) => bar.low)),
        close: last.close,
        volume: group.reduce((sum, bar) => sum + bar.volume, 0),
      });
    }
  }

  return aggregated.sort((a, b) => Number(a.time) - Number(b.time));
}

export function filterBarsByRange(bars: MarketBar[], range: ChartRange) {
  if (!bars.length) return bars;
  const months = range === "6M" ? 6 : range === "1Y" ? 12 : 24;
  const last = new Date(marketTimeToMilliseconds(bars[bars.length - 1].time));
  last.setUTCMonth(last.getUTCMonth() - months);
  const cutoff = last.getTime();
  return bars.filter(
    (bar) => marketTimeToMilliseconds(bar.time) >= cutoff,
  );
}

export function marketTimeToMilliseconds(time: MarketTime) {
  if (typeof time === "number") return time * 1000;
  return new Date(`${time}T00:00:00Z`).getTime();
}

export function formatMarketTime(time: MarketTime) {
  if (typeof time === "string") return time;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(time * 1000));
}

export function isForecastRecordArray(value: unknown): value is ForecastRecord[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "symbol" in item &&
        "asOfDate" in item &&
        "narrative" in item &&
        "path" in item,
    )
  );
}
