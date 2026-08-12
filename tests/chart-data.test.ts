import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateIntradayBars,
  filterBarsByRange,
} from "../app/chart-data.ts";
import type { MarketBar } from "../app/types.ts";

const sessionStart = Date.parse("2026-07-28T13:30:00Z") / 1000;
const hourlyBars: MarketBar[] = Array.from({ length: 8 }, (_, index) => ({
  time: sessionStart + index * 60 * 60,
  open: 100 + index,
  high: 102 + index,
  low: 99 + index,
  close: 101 + index,
  volume: 1_000 + index,
}));

test("aggregates hourly equity bars into 4H candles without losing OHLC", () => {
  const bars = aggregateIntradayBars(hourlyBars, 4);

  assert.equal(bars.length, 2);
  assert.deepEqual(bars[0], {
    time: sessionStart,
    open: 100,
    high: 105,
    low: 99,
    close: 104,
    volume: 4_006,
  });
});

test("keeps a partial final 6H candle for the regular session close", () => {
  const bars = aggregateIntradayBars(hourlyBars, 6);

  assert.equal(bars.length, 2);
  assert.equal(bars[0].close, 106);
  assert.equal(bars[1].open, 106);
  assert.equal(bars[1].close, 108);
});

test("filters numeric intraday timestamps by the selected date range", () => {
  const oldBar = {
    ...hourlyBars[0],
    time: Date.parse("2025-01-01T14:30:00Z") / 1000,
  };
  const recent = filterBarsByRange([oldBar, ...hourlyBars], "6M");

  assert.equal(recent.some((bar) => bar.time === oldBar.time), false);
  assert.equal(recent.length, hourlyBars.length);
});

