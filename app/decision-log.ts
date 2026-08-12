import type {
  DecisionAction,
  DecisionOutcome,
  DecisionStatus,
  PricingScenario,
  TradeInstrument,
  TradePlanRecord,
} from "./types";

export const ORDER_PLAN_STORAGE_KEY = "trader-research-order-plans:v1";

export const DECISION_ACTION_LABEL: Record<DecisionAction, string> = {
  wait: "等待 / 不行动",
  enter: "准备建仓",
  add: "准备加仓",
  trim: "准备减仓",
  exit: "准备退出",
  hedge: "准备对冲",
};

export const DECISION_OUTCOME_LABEL: Record<DecisionOutcome, string> = {
  open: "尚未复盘",
  right: "判断正确",
  wrong: "判断错误",
  mixed: "部分正确",
};

export type DecisionTiming = "overdue" | "today" | "upcoming";

export type DecisionQueueItem = {
  record: TradePlanRecord;
  timing: DecisionTiming;
  daysUntil: number;
};

export type DecisionQueueSummary = {
  overdue: number;
  today: number;
  next7Days: number;
  open: number;
  reviewed: number;
};

const ACTIONS = new Set<DecisionAction>([
  "wait",
  "enter",
  "add",
  "trim",
  "exit",
  "hedge",
]);
const STATUSES = new Set<DecisionStatus>([
  "planned",
  "reviewed",
  "cancelled",
]);
const OUTCOMES = new Set<DecisionOutcome>([
  "open",
  "right",
  "wrong",
  "mixed",
]);
const INSTRUMENTS = new Set<TradeInstrument>(["stock", "call", "put"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function dateOnlyMilliseconds(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const milliseconds = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

export function defaultReviewDate(asOfDate: string, days = 7) {
  const milliseconds = dateOnlyMilliseconds(asOfDate);
  if (milliseconds === null) return asOfDate;
  const date = new Date(milliseconds + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function normalizeScenarios(value: unknown): PricingScenario[] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const scenarios = value.flatMap((item): PricingScenario[] => {
    if (!isRecord(item)) return [];
    const id = item.id;
    if (id !== "bear" && id !== "base" && id !== "bull") return [];
    return [
      {
        id,
        probability: numberOrZero(item.probability),
        targetPrice: numberOrZero(item.targetPrice),
      },
    ];
  });
  return scenarios.length === 3 ? scenarios : null;
}

export function normalizeTradePlanRecord(
  value: unknown,
): TradePlanRecord | null {
  if (!isRecord(value)) return null;
  const scenarios = normalizeScenarios(value.scenarios);
  const id = text(value.id);
  const symbol = text(value.symbol).trim().toUpperCase();
  const asOfDate = text(value.asOfDate);
  if (!id || !symbol || !asOfDate || !scenarios) return null;

  const action = ACTIONS.has(value.action as DecisionAction)
    ? (value.action as DecisionAction)
    : "enter";
  const status = STATUSES.has(value.status as DecisionStatus)
    ? (value.status as DecisionStatus)
    : "planned";
  const outcome = OUTCOMES.has(value.outcome as DecisionOutcome)
    ? (value.outcome as DecisionOutcome)
    : "open";
  const instrument = INSTRUMENTS.has(value.instrument as TradeInstrument)
    ? (value.instrument as TradeInstrument)
    : "stock";

  return {
    id,
    symbol,
    assetName: text(value.assetName) || symbol,
    asOfDate,
    currentPrice: numberOrZero(value.currentPrice),
    scenarios,
    instrument,
    portfolioValue: numberOrZero(value.portfolioValue),
    maxRiskPercent: numberOrZero(value.maxRiskPercent),
    entryPrice: numberOrZero(value.entryPrice),
    stopPrice: optionalNumber(value.stopPrice),
    targetPrice: optionalNumber(value.targetPrice),
    expiry: text(value.expiry) || undefined,
    strike: optionalNumber(value.strike),
    exitPremium: optionalNumber(value.exitPremium),
    multiplier: numberOrZero(value.multiplier) || 100,
    quantity: numberOrZero(value.quantity),
    thesis: text(value.thesis),
    invalidation: text(value.invalidation),
    checklist: Array.isArray(value.checklist)
      ? value.checklist.filter((item): item is string => typeof item === "string")
      : [],
    action,
    status,
    reviewAt: text(value.reviewAt) || defaultReviewDate(asOfDate),
    outcome,
    reviewNote: text(value.reviewNote),
    marketSource: text(value.marketSource),
    marketFetchedAt: text(value.marketFetchedAt),
    updatedAt: text(value.updatedAt) || `${asOfDate}T00:00:00.000Z`,
  };
}

export function normalizeTradePlans(value: unknown): TradePlanRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = normalizeTradePlanRecord(item);
    return record ? [record] : [];
  });
}

export function decisionDaysUntil(reviewAt: string, asOfDate: string) {
  const review = dateOnlyMilliseconds(reviewAt);
  const asOf = dateOnlyMilliseconds(asOfDate);
  if (review === null || asOf === null) return null;
  return Math.round((review - asOf) / 86_400_000);
}

export function buildDecisionQueue(
  records: TradePlanRecord[],
  asOfDate: string,
) {
  const items = records.flatMap((record): DecisionQueueItem[] => {
    if (record.status !== "planned") return [];
    const daysUntil = decisionDaysUntil(record.reviewAt, asOfDate);
    if (daysUntil === null) return [];
    return [
      {
        record,
        daysUntil,
        timing:
          daysUntil < 0
            ? "overdue"
            : daysUntil === 0
              ? "today"
              : "upcoming",
      },
    ];
  });

  items.sort((left, right) => {
    const leftOverdue = left.daysUntil < 0;
    const rightOverdue = right.daysUntil < 0;
    if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
    return (
      left.daysUntil - right.daysUntil ||
      right.record.updatedAt.localeCompare(left.record.updatedAt)
    );
  });

  const summary: DecisionQueueSummary = {
    overdue: items.filter((item) => item.daysUntil < 0).length,
    today: items.filter((item) => item.daysUntil === 0).length,
    next7Days: items.filter(
      (item) => item.daysUntil > 0 && item.daysUntil <= 7,
    ).length,
    open: items.length,
    reviewed: records.filter((record) => record.status === "reviewed").length,
  };

  return { items, summary };
}
