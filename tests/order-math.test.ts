import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTradeMetrics,
  expectedTargetPrice,
  probabilityTotal,
} from "../app/order-math.ts";

const scenarios = [
  { id: "bear" as const, probability: 25, targetPrice: 80 },
  { id: "base" as const, probability: 50, targetPrice: 100 },
  { id: "bull" as const, probability: 25, targetPrice: 140 },
];

test("requires scenario probabilities to total 100", () => {
  assert.equal(probabilityTotal(scenarios), 100);
  assert.equal(expectedTargetPrice(scenarios), 105);
  assert.equal(
    expectedTargetPrice(
      scenarios.map((scenario) => ({ ...scenario, probability: 20 })),
    ),
    undefined,
  );
});

test("sizes a stock position from the stop distance", () => {
  const metrics = calculateTradeMetrics({
    instrument: "stock",
    portfolioValue: 100_000,
    maxRiskPercent: 1,
    entryPrice: 100,
    stopPrice: 95,
    targetPrice: 115,
    multiplier: 1,
    quantity: 200,
  });

  assert.equal(metrics.riskBudget, 1_000);
  assert.equal(metrics.suggestedQuantity, 200);
  assert.equal(metrics.plannedRisk, 1_000);
  assert.equal(metrics.plannedReward, 3_000);
  assert.equal(metrics.riskReward, 3);
});

test("caps a long option position at the premium paid", () => {
  const metrics = calculateTradeMetrics({
    instrument: "call",
    portfolioValue: 100_000,
    maxRiskPercent: 1,
    entryPrice: 2.5,
    strike: 100,
    exitPremium: 5,
    multiplier: 100,
    quantity: 4,
  });

  assert.equal(metrics.suggestedQuantity, 4);
  assert.equal(metrics.plannedRisk, 1_000);
  assert.equal(metrics.plannedReward, 1_000);
  assert.equal(metrics.breakEven, 102.5);
  assert.equal(metrics.riskReward, 1);
});
