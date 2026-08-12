import type { PricingScenario, TradeInstrument } from "./types";

export type TradeMetricInput = {
  instrument: TradeInstrument;
  portfolioValue: number;
  maxRiskPercent: number;
  entryPrice: number;
  stopPrice?: number;
  targetPrice?: number;
  strike?: number;
  exitPremium?: number;
  multiplier: number;
  quantity: number;
};

export type TradeMetrics = {
  riskBudget: number;
  riskPerUnit: number;
  suggestedQuantity: number;
  plannedRisk: number;
  plannedReward?: number;
  capitalRequired: number;
  breakEven?: number;
  riskReward?: number;
};

function positive(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

export function probabilityTotal(scenarios: PricingScenario[]) {
  return scenarios.reduce(
    (total, scenario) => total + positive(scenario.probability),
    0,
  );
}

export function expectedTargetPrice(scenarios: PricingScenario[]) {
  const total = probabilityTotal(scenarios);
  if (Math.abs(total - 100) > 0.001) return undefined;
  return scenarios.reduce(
    (expected, scenario) =>
      expected +
      positive(scenario.targetPrice) * (positive(scenario.probability) / 100),
    0,
  );
}

export function calculateTradeMetrics(
  input: TradeMetricInput,
): TradeMetrics {
  const portfolioValue = positive(input.portfolioValue);
  const maxRiskPercent = positive(input.maxRiskPercent);
  const entryPrice = positive(input.entryPrice);
  const multiplier = Math.max(1, Math.floor(positive(input.multiplier) || 1));
  const quantity = Math.max(0, Math.floor(positive(input.quantity)));
  const riskBudget = portfolioValue * (maxRiskPercent / 100);

  if (input.instrument === "stock") {
    const stopPrice = positive(input.stopPrice);
    const targetPrice = positive(input.targetPrice);
    const riskPerUnit =
      stopPrice > 0 && entryPrice > stopPrice ? entryPrice - stopPrice : 0;
    const suggestedQuantity =
      riskPerUnit > 0 ? Math.floor(riskBudget / riskPerUnit) : 0;
    const plannedRisk = riskPerUnit * quantity;
    const plannedReward =
      targetPrice > entryPrice ? (targetPrice - entryPrice) * quantity : 0;

    return {
      riskBudget,
      riskPerUnit,
      suggestedQuantity,
      plannedRisk,
      plannedReward,
      capitalRequired: entryPrice * quantity,
      riskReward:
        plannedRisk > 0 && plannedReward > 0
          ? plannedReward / plannedRisk
          : undefined,
    };
  }

  const strike = positive(input.strike);
  const exitPremium = positive(input.exitPremium);
  const riskPerUnit = entryPrice * multiplier;
  const suggestedQuantity =
    riskPerUnit > 0 ? Math.floor(riskBudget / riskPerUnit) : 0;
  const plannedRisk = riskPerUnit * quantity;
  const plannedReward =
    exitPremium > entryPrice
      ? (exitPremium - entryPrice) * multiplier * quantity
      : undefined;
  const breakEven =
    strike > 0 && entryPrice > 0
      ? input.instrument === "call"
        ? strike + entryPrice
        : strike - entryPrice
      : undefined;

  return {
    riskBudget,
    riskPerUnit,
    suggestedQuantity,
    plannedRisk,
    plannedReward,
    capitalRequired: plannedRisk,
    breakEven,
    riskReward:
      plannedRisk > 0 && plannedReward !== undefined
        ? plannedReward / plannedRisk
        : undefined,
  };
}
