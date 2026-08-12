import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDecisionQueue,
  defaultReviewDate,
  normalizeTradePlanRecord,
} from "../app/decision-log.ts";
import type { TradePlanRecord } from "../app/types.ts";

function decision(
  id: string,
  reviewAt: string,
  updatedAt = "2026-08-01T00:00:00.000Z",
): TradePlanRecord {
  return {
    id,
    symbol: "QQQ",
    assetName: "纳指 100 ETF",
    asOfDate: "2026-08-01",
    currentPrice: 500,
    scenarios: [
      { id: "bear", probability: 25, targetPrice: 450 },
      { id: "base", probability: 50, targetPrice: 510 },
      { id: "bull", probability: 25, targetPrice: 560 },
    ],
    instrument: "stock",
    portfolioValue: 100000,
    maxRiskPercent: 1,
    entryPrice: 500,
    stopPrice: 490,
    targetPrice: 530,
    multiplier: 1,
    quantity: 10,
    thesis: "等待价格确认后再行动。",
    invalidation: "关键趋势破位。",
    checklist: [],
    action: "wait",
    status: "planned",
    reviewAt,
    outcome: "open",
    reviewNote: "",
    marketSource: "test",
    marketFetchedAt: updatedAt,
    updatedAt,
  };
}

test("gives new decisions a seven-day review date", () => {
  assert.equal(defaultReviewDate("2026-08-12"), "2026-08-19");
});

test("migrates a legacy local plan into a reviewable decision", () => {
  const legacy = decision("legacy", "2026-08-08") as unknown as Record<
    string,
    unknown
  >;
  delete legacy.action;
  delete legacy.status;
  delete legacy.reviewAt;
  delete legacy.outcome;
  delete legacy.reviewNote;

  const normalized = normalizeTradePlanRecord(legacy);
  assert.equal(normalized?.action, "enter");
  assert.equal(normalized?.status, "planned");
  assert.equal(normalized?.reviewAt, "2026-08-08");
  assert.equal(normalized?.outcome, "open");
});

test("prioritizes overdue reviews and excludes completed records", () => {
  const overdue = decision("overdue", "2026-08-10");
  const today = decision("today", "2026-08-12");
  const upcoming = decision("upcoming", "2026-08-15");
  const reviewed = { ...decision("reviewed", "2026-08-09"), status: "reviewed" as const };

  const queue = buildDecisionQueue(
    [upcoming, reviewed, today, overdue],
    "2026-08-12",
  );

  assert.deepEqual(
    queue.items.map((item) => item.record.id),
    ["overdue", "today", "upcoming"],
  );
  assert.deepEqual(queue.summary, {
    overdue: 1,
    today: 1,
    next7Days: 1,
    open: 3,
    reviewed: 1,
  });
});
