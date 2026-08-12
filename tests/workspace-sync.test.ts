import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ASSETS } from "../app/data.ts";
import {
  emptyWorkspace,
  markAssetDeleted,
  mergeWorkspaces,
} from "../app/workspace-sync.ts";
import type { Asset, TradePlanRecord } from "../app/types.ts";

function asset(
  symbol: string,
  modifiedAt: string,
  name = symbol,
): Asset {
  return {
    ...structuredClone(DEFAULT_ASSETS[0]),
    id: `${symbol.toLowerCase()}-test`,
    symbol,
    name,
    market: "NYSE",
    modifiedAt,
  };
}

test("keeps a phone-only symbol when first merging with cloud data", () => {
  const glw = asset("GLW", "2026-07-29T02:00:00.000Z", "康宁");
  const qqq = asset("QQQ", "2026-07-28T02:00:00.000Z");

  const merged = mergeWorkspaces(
    emptyWorkspace([glw]),
    emptyWorkspace([qqq]),
  );

  assert.deepEqual(
    merged.assets.map((item) => item.symbol).sort(),
    ["GLW", "QQQ"],
  );
});

test("uses the newest research version for the same market symbol", () => {
  const older = asset("GLW", "2026-07-28T02:00:00.000Z", "旧版");
  const newer = asset("GLW", "2026-07-29T02:00:00.000Z", "康宁");

  const merged = mergeWorkspaces(
    emptyWorkspace([newer]),
    emptyWorkspace([older]),
  );

  assert.equal(merged.assets.length, 1);
  assert.equal(merged.assets[0].name, "康宁");
});

test("propagates a newer deletion instead of resurrecting an old symbol", () => {
  const glw = asset("GLW", "2026-07-28T02:00:00.000Z", "康宁");
  const tombstones = markAssetDeleted(
    {},
    glw,
    "2026-07-29T02:00:00.000Z",
  );

  const merged = mergeWorkspaces(
    { ...emptyWorkspace(), tombstones },
    emptyWorkspace([glw]),
  );

  assert.equal(merged.assets.length, 0);
});

function decision(id: string, updatedAt: string, thesis: string): TradePlanRecord {
  return {
    id,
    symbol: "GLW",
    assetName: "康宁",
    asOfDate: "2026-08-01",
    currentPrice: 50,
    scenarios: [
      { id: "bear", probability: 25, targetPrice: 40 },
      { id: "base", probability: 50, targetPrice: 52 },
      { id: "bull", probability: 25, targetPrice: 60 },
    ],
    instrument: "stock",
    portfolioValue: 0,
    maxRiskPercent: 0,
    entryPrice: 0,
    multiplier: 100,
    quantity: 0,
    thesis,
    invalidation: "需求证伪",
    checklist: [],
    action: "wait",
    status: "planned",
    reviewAt: "2026-08-08",
    outcome: "open",
    reviewNote: "",
    marketSource: "test",
    marketFetchedAt: updatedAt,
    updatedAt,
  };
}

test("keeps decisions from both devices and resolves same-id edits by timestamp", () => {
  const phoneOnly = decision("glw-phone", "2026-08-01T01:00:00.000Z", "手机新增");
  const older = decision("glw-shared", "2026-08-01T01:00:00.000Z", "旧判断");
  const newer = decision("glw-shared", "2026-08-02T01:00:00.000Z", "新判断");

  const merged = mergeWorkspaces(
    { ...emptyWorkspace(), decisions: [phoneOnly, newer] },
    { ...emptyWorkspace(), decisions: [older] },
  );

  assert.equal(merged.decisions.length, 2);
  assert.equal(
    merged.decisions.find((item) => item.id === "glw-shared")?.thesis,
    "新判断",
  );
});
