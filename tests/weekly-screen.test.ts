import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateCompletedWeeklyBars,
  evaluateTwoCompletedBullishWeeks,
  isUsListedMarket,
} from "../app/weekly-screen.ts";
import type { MarketBar } from "../app/types.ts";

function day(time: string, open: number, close: number): MarketBar {
  return {
    time,
    open,
    close,
    high: Math.max(open, close) + 1,
    low: Math.min(open, close) - 1,
    volume: 1_000,
  };
}

test("recognizes US-listed stock and ETF markets only", () => {
  assert.equal(isUsListedMarket("NASDAQ"), true);
  assert.equal(isUsListedMarket("NYSE ARCA"), true);
  assert.equal(isUsListedMarket("KRX"), false);
  assert.equal(isUsListedMarket("BINANCE FUTURES"), false);
});

test("aggregates daily bars and excludes the unfinished current week", () => {
  const bars = [
    day("2026-09-28", 100, 101),
    day("2026-10-02", 101, 104),
    day("2026-10-05", 104, 105),
    day("2026-10-09", 105, 108),
    day("2026-10-12", 108, 120),
  ];

  const weeks = aggregateCompletedWeeklyBars(
    bars,
    new Date("2026-10-14T12:00:00Z"),
  );
  assert.equal(weeks.length, 2);
  assert.deepEqual(
    weeks.map((week) => [week.weekStart, week.open, week.close]),
    [
      ["2026-09-28", 100, 104],
      ["2026-10-05", 104, 108],
    ],
  );
});

test("matches two adjacent completed bullish weekly candles", () => {
  const result = evaluateTwoCompletedBullishWeeks(
    [
      day("2026-09-28", 100, 101),
      day("2026-10-02", 101, 104),
      day("2026-10-05", 104, 105),
      day("2026-10-09", 105, 108),
      day("2026-10-12", 108, 90),
    ],
    new Date("2026-10-14T12:00:00Z"),
  );

  assert.equal(result.matched, true);
  assert.equal(result.reason, "matched");
  assert.equal(result.weeks.every((week) => week.changePercent > 0), true);
});

test("does not match a red week or a gap in the weekly history", () => {
  const redWeek = evaluateTwoCompletedBullishWeeks(
    [day("2026-09-28", 100, 104), day("2026-10-05", 104, 102)],
    new Date("2026-10-14T12:00:00Z"),
  );
  assert.equal(redWeek.reason, "not_bullish");

  const gap = evaluateTwoCompletedBullishWeeks(
    [day("2026-09-21", 100, 104), day("2026-10-05", 104, 108)],
    new Date("2026-10-14T12:00:00Z"),
  );
  assert.equal(gap.reason, "week_gap");
});
