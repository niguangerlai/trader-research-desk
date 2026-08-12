import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ASSETS } from "../app/data.ts";
import {
  buildPortfolioRisk,
  inferRiskTheme,
  legacyPositionWeight,
} from "../app/portfolio-risk.ts";
import type { Asset } from "../app/types.ts";

function holding(
  symbol: string,
  weight: number | undefined,
  sector: string,
  overrides: Partial<Asset> = {},
): Asset {
  return {
    ...structuredClone(DEFAULT_ASSETS[0]),
    id: `${symbol.toLowerCase()}-holding`,
    symbol,
    name: symbol,
    status: "holding",
    sector,
    portfolioWeight: weight,
    positionSize: undefined,
    fundamentalSignals: [],
    ...overrides,
  };
}

test("reads only an exact percent string as a legacy portfolio weight", () => {
  assert.equal(legacyPositionWeight("12.5%"), 12.5);
  assert.equal(legacyPositionWeight("小仓位"), null);
  assert.equal(legacyPositionWeight("120%"), null);
});

test("returns a stable empty report when nothing is marked as a holding", () => {
  const report = buildPortfolioRisk(DEFAULT_ASSETS);
  assert.equal(report.holdings.length, 0);
  assert.equal(report.largestPosition, null);
  assert.equal(report.recordedWeight, 0);
  assert.deepEqual(report.monitoringNotes, []);
});

test("groups AI capex holdings transparently without claiming correlation", () => {
  assert.equal(inferRiskTheme(holding("MU", 12, "HBM / DRAM / NAND")), "AI 资本开支链");
  assert.equal(inferRiskTheme(holding("BTC-USD", 5, "加密资产 / BTCUSDT永续")), "加密流动性");
});

test("calculates concentration from recorded holdings and exposes missing data", () => {
  const mu = holding("MU", 25, "HBM / DRAM / NAND", {
    category: "type2",
    fundamentalSignals: [
      { id: "mu-risk", label: "价格", state: "negative", note: "下修" },
    ],
  });
  const aaoi = holding("AAOI", 18, "光模块 / 数据中心", {
    category: "type2",
  });
  const gold = holding("GC=F", 10, "大宗商品 / 贵金属", {
    category: "type1",
  });
  const missing = holding("ORCL", undefined, "云基础设施 / 软件");
  const watchOnly = { ...holding("QQQ", 30, "指数 / 大型科技"), status: "watching" as const };

  const report = buildPortfolioRisk([mu, aaoi, gold, missing, watchOnly]);

  assert.equal(report.holdings.length, 4);
  assert.equal(report.recordedWeight, 53);
  assert.equal(report.residualWeight, 47);
  assert.equal(report.topThreeWeight, 53);
  assert.equal(report.largestPosition?.asset.symbol, "MU");
  assert.equal(report.missingHoldings[0].asset.symbol, "ORCL");
  assert.deepEqual(report.themes[0], {
    label: "AI 资本开支链",
    weight: 43,
    symbols: ["MU", "AAOI"],
  });
  assert.equal(report.negativeSignalWeight, 25);
  assert.equal(report.type23Weight, 43);
  assert.match(report.monitoringNotes.join(" "), /同一故事 40% 监控线/);
  assert.match(report.monitoringNotes.join(" "), /1 个持仓尚未录入/);
});

test("flags an over-allocated recorded portfolio instead of calling the residual cash", () => {
  const report = buildPortfolioRisk([
    holding("MU", 60, "HBM / DRAM"),
    holding("AAOI", 50, "光模块 / 数据中心"),
  ]);

  assert.equal(report.recordedWeight, 110);
  assert.equal(report.residualWeight, 0);
  assert.equal(report.overAllocatedWeight, 10);
  assert.match(report.monitoringNotes.join(" "), /超过 100%/);
});
