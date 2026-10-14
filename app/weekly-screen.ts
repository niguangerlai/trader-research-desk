import type { MarketBar, MarketTime } from "./types";

export type WeeklyCandle = {
  weekStart: string;
  firstTradingDay: string;
  lastTradingDay: string;
  open: number;
  close: number;
  changePercent: number;
  bullish: boolean;
};

export type TwoWeekBullishResult = {
  matched: boolean;
  reason: "matched" | "not_bullish" | "insufficient_data" | "week_gap";
  weeks: WeeklyCandle[];
};

const US_MARKET_PATTERN = /(?:NASDAQ|NYSE|AMEX|ARCA|US EQUIT)/i;

export function isUsListedMarket(market: string) {
  return US_MARKET_PATTERN.test(market.trim());
}

function toDate(time: MarketTime) {
  if (typeof time === "number") {
    return new Date(time > 10_000_000_000 ? time : time * 1_000);
  }
  return new Date(`${time.slice(0, 10)}T12:00:00Z`);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function weekStartFor(time: MarketTime) {
  const date = toDate(time);
  if (!Number.isFinite(date.getTime())) return "";
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  date.setUTCHours(0, 0, 0, 0);
  return toIsoDate(date);
}

export function aggregateCompletedWeeklyBars(
  bars: MarketBar[],
  asOf: Date = new Date(),
) {
  const currentWeekStart = weekStartFor(asOf.toISOString().slice(0, 10));
  const sorted = [...bars].sort((left, right) =>
    String(left.time).localeCompare(String(right.time)),
  );
  const weeks = new Map<string, WeeklyCandle>();

  for (const bar of sorted) {
    const weekStart = weekStartFor(bar.time);
    const tradingDay = toIsoDate(toDate(bar.time));
    if (!weekStart || weekStart >= currentWeekStart) continue;
    if (![bar.open, bar.close].every(Number.isFinite) || bar.open <= 0) continue;

    const existing = weeks.get(weekStart);
    if (!existing) {
      weeks.set(weekStart, {
        weekStart,
        firstTradingDay: tradingDay,
        lastTradingDay: tradingDay,
        open: bar.open,
        close: bar.close,
        changePercent: ((bar.close - bar.open) / bar.open) * 100,
        bullish: bar.close > bar.open,
      });
      continue;
    }

    existing.lastTradingDay = tradingDay;
    existing.close = bar.close;
    existing.changePercent =
      ((existing.close - existing.open) / existing.open) * 100;
    existing.bullish = existing.close > existing.open;
  }

  return Array.from(weeks.values()).sort((left, right) =>
    left.weekStart.localeCompare(right.weekStart),
  );
}

function areAdjacentWeeks(earlier: string, later: string) {
  const difference =
    Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`);
  return difference === 7 * 24 * 60 * 60 * 1_000;
}

export function evaluateTwoCompletedBullishWeeks(
  bars: MarketBar[],
  asOf: Date = new Date(),
): TwoWeekBullishResult {
  const weeks = aggregateCompletedWeeklyBars(bars, asOf).slice(-2);
  if (weeks.length < 2) {
    return { matched: false, reason: "insufficient_data", weeks };
  }
  if (!areAdjacentWeeks(weeks[0].weekStart, weeks[1].weekStart)) {
    return { matched: false, reason: "week_gap", weeks };
  }
  if (!weeks.every((week) => week.bullish)) {
    return { matched: false, reason: "not_bullish", weeks };
  }
  return { matched: true, reason: "matched", weeks };
}
