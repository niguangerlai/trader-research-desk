import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ASSETS } from "../app/data.ts";
import {
  buildEventRadar,
  eventDaysUntil,
} from "../app/event-radar.ts";
import type { Asset, ResearchEvent } from "../app/types.ts";

function event(
  id: string,
  date: string,
  overrides: Partial<ResearchEvent> = {},
): ResearchEvent {
  return {
    id,
    date,
    title: id,
    kind: "earnings",
    impact: "high",
    status: "scheduled",
    preparation: "更新前后预期差",
    ...overrides,
  };
}

function asset(overrides: Partial<Asset>): Asset {
  return { ...structuredClone(DEFAULT_ASSETS[0]), ...overrides };
}

test("calculates event distance from date-only records", () => {
  assert.equal(eventDaysUntil("2026-08-19", "2026-08-12"), 7);
  assert.equal(eventDaysUntil("2026-08-10", "2026-08-12"), -2);
  assert.equal(eventDaysUntil("Aug 19", "2026-08-12"), null);
});

test("puts unreviewed past events first and ignores completed events", () => {
  const holding = asset({
    id: "holding",
    symbol: "HOLD",
    status: "holding",
    keyEvents: [event("missed", "2026-08-10")],
  });
  const watcher = asset({
    id: "watcher",
    symbol: "WATCH",
    keyEvents: [
      event("soon", "2026-08-14"),
      event("reviewed", "2026-08-11", { status: "reviewed" }),
      event("stale", "2026-07-01"),
      event("later", "2026-10-01"),
    ],
  });

  const result = buildEventRadar([watcher, holding], "2026-08-12", 30);
  assert.deepEqual(
    result.items.map((item) => item.event.id),
    ["missed", "soon"],
  );
  assert.equal(result.summary.overdue, 1);
  assert.equal(result.summary.next7Days, 1);
});

test("counts undated catalysts separately from scheduled events", () => {
  const result = buildEventRadar(
    [asset({ catalyst: ["订单上修", "价格确认"], keyEvents: [] })],
    "2026-08-12",
  );
  assert.equal(result.summary.conditionalCatalysts, 2);
  assert.equal(result.summary.inWindow, 0);
});
