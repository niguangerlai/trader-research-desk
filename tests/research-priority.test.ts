import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ASSETS } from "../app/data.ts";
import {
  buildResearchQueue,
  researchAgeDays,
  scoreResearchPriority,
} from "../app/research-priority.ts";
import type { Asset } from "../app/types.ts";

function asset(overrides: Partial<Asset>): Asset {
  return {
    ...structuredClone(DEFAULT_ASSETS[0]),
    ...overrides,
  };
}

test("calculates research age from date-only Shanghai records", () => {
  assert.equal(researchAgeDays("2026-07-22", "2026-08-12"), 21);
  assert.equal(researchAgeDays("invalid", "2026-08-12"), null);
});

test("makes a stale holding urgent even without a negative signal", () => {
  const result = scoreResearchPriority(
    asset({
      id: "holding",
      symbol: "HOLD",
      status: "holding",
      updatedAt: "2026-08-01",
      fundamentalSignals: [],
    }),
    "2026-08-12",
  );

  assert.equal(result.priority, "urgent");
  assert.match(result.reasons.join(" "), /持仓优先/);
  assert.match(result.reasons.join(" "), /11 天未更新/);
});

test("puts invalidated and negative theses ahead of current watch items", () => {
  const risky = asset({
    id: "risky",
    symbol: "RISK",
    updatedAt: "2026-08-10",
    fundamentalSignals: [
      { id: "risk", label: "需求", state: "negative", note: "下修" },
    ],
    lastComparison: {
      generatedAt: "2026-08-10T00:00:00Z",
      evidenceAsOf: "2026-08-10",
      changeSummary: [],
      drivers: [],
      verdicts: [
        { claim: "需求上修", verdict: "invalidated", explanation: "已下修" },
      ],
      recentNews: [],
    },
  });
  const current = asset({
    id: "current",
    symbol: "CURR",
    status: "watching",
    category: "type1",
    updatedAt: "2026-08-12",
    fundamentalSignals: [],
    lastComparison: undefined,
  });

  const queue = buildResearchQueue([current, risky], "2026-08-12");
  assert.equal(queue[0].assetId, "risky");
  assert.equal(queue[0].priority, "urgent");
  assert.equal(queue[1].priority, "current");
});
