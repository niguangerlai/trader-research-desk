export type Regime = "type1" | "type2" | "type3" | "unclassified";

export type AssetStatus = "watching" | "holding" | "avoid";

export type SignalState = "positive" | "warning" | "negative" | "neutral";

export type Signal = {
  id: string;
  label: string;
  state: SignalState;
  note: string;
};

export type ResearchEventKind =
  | "earnings"
  | "macro"
  | "industry"
  | "regulatory"
  | "product"
  | "crypto"
  | "other";

export type ResearchEvent = {
  id: string;
  date: string;
  title: string;
  kind: ResearchEventKind;
  impact: "high" | "medium" | "low";
  status: "scheduled" | "reviewed" | "cancelled";
  preparation: string;
  source?: string;
};

export type EventTemplateId =
  | "us-cpi"
  | "us-ppi"
  | "fomc"
  | "jackson-hole";

export type CalendarEventTemplate = {
  id: EventTemplateId;
  date: string;
  title: string;
  kind: ResearchEventKind;
  impact: ResearchEvent["impact"];
  preparation: string;
  source: string;
  defaultSymbols: string[];
};

export type TechnicalLevel = {
  label: string;
  value: string;
  role: "support" | "resistance" | "pivot";
};

export type ResearchSnapshot = {
  updatedAt: string;
  dataFreshness: string;
  category: Regime;
  conviction: "high" | "medium" | "low" | "pending";
  valuationLogic: string;
  thesis: string;
  catalyst: string[];
  keyEvents?: ResearchEvent[];
  invalidation: string[];
  fundamentalSignals: Signal[];
  technical: {
    trend: string;
    momentum: string;
    structure: string;
    levels: TechnicalLevel[];
    action: string;
  };
  sources: string[];
};

export type ResearchVerdict = {
  claim: string;
  verdict: "confirmed" | "invalidated" | "open";
  explanation: string;
};

export type ResearchComparison = {
  generatedAt: string;
  evidenceAsOf: string;
  changeSummary: string[];
  drivers: string[];
  verdicts: ResearchVerdict[];
  recentNews: Array<{
    title: string;
    publisher: string;
    publishedAt: string;
    url: string;
  }>;
};

export type Asset = {
  id: string;
  symbol: string;
  name: string;
  market: string;
  sector: string;
  status: AssetStatus;
  category: Regime;
  conviction: "high" | "medium" | "low" | "pending";
  modifiedAt?: string;
  positionSize?: string;
  portfolioWeight?: number;
  riskTheme?: string;
  averageCost?: string;
  updatedAt: string;
  dataFreshness: string;
  valuationLogic: string;
  thesis: string;
  catalyst: string[];
  keyEvents?: ResearchEvent[];
  invalidation: string[];
  fundamentalSignals: Signal[];
  technical: {
    trend: string;
    momentum: string;
    structure: string;
    levels: TechnicalLevel[];
    action: string;
  };
  sources: string[];
  previousVersion?: ResearchSnapshot;
  lastComparison?: ResearchComparison;
};

export type CategoryDefinition = {
  id: Regime;
  short: string;
  title: string;
  description: string;
  action: string;
};

export type MarketTime = string | number;

export type MarketBar = {
  time: MarketTime;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartRange = "6M" | "1Y" | "2Y";

export type ChartTimeframe = "4H" | "6H" | "1D" | "1W";

export type IndicatorLinePoint = {
  time: MarketTime;
  value: number;
};

export type IndicatorMarker = {
  time: MarketTime;
  position: "aboveBar" | "belowBar";
  shape: "arrowUp" | "arrowDown" | "circle";
  text: string;
  tone: "positive" | "negative" | "neutral";
};

export type TraderCIndicatorSnapshot = {
  asOf: MarketTime;
  momentum: "向上" | "向下" | "均衡";
  momentumScore: number;
  volatility: "宽幅" | "常态" | "窄幅";
  structure: "HH + HL" | "LH + LL" | "混合";
  channelPosition: "上沿" | "中部" | "下沿";
  regime: string;
};

export type TraderCIndicatorResult = {
  ema20: IndicatorLinePoint[];
  ema50: IndicatorLinePoint[];
  channelUpper: IndicatorLinePoint[];
  channelLower: IndicatorLinePoint[];
  channelMid: IndicatorLinePoint[];
  vwap20: IndicatorLinePoint[];
  markers: IndicatorMarker[];
  snapshot: TraderCIndicatorSnapshot | null;
};

export type ForecastBias = "bullish" | "neutral" | "bearish";

export type ForecastPoint = {
  date: string;
  price: number;
};

export type ForecastRecord = {
  id: string;
  symbol: "QQQ";
  asOfDate: string;
  title: string;
  bias: ForecastBias;
  narrative: string;
  confirmation: string;
  invalidation: string;
  triggerPrice?: number;
  invalidationPrice?: number;
  path: ForecastPoint[];
  createdAt: string;
  updatedAt: string;
};

export type PricingScenarioId = "bear" | "base" | "bull";

export type PricingScenario = {
  id: PricingScenarioId;
  probability: number;
  targetPrice: number;
};

export type TradeInstrument = "stock" | "call" | "put";

export type DecisionAction =
  | "wait"
  | "enter"
  | "add"
  | "trim"
  | "exit"
  | "hedge";

export type DecisionStatus = "planned" | "reviewed" | "cancelled";

export type DecisionOutcome = "open" | "right" | "wrong" | "mixed";

export type TradePlanRecord = {
  id: string;
  symbol: string;
  assetName: string;
  asOfDate: string;
  currentPrice: number;
  scenarios: PricingScenario[];
  instrument: TradeInstrument;
  portfolioValue: number;
  maxRiskPercent: number;
  entryPrice: number;
  stopPrice?: number;
  targetPrice?: number;
  expiry?: string;
  strike?: number;
  exitPremium?: number;
  multiplier: number;
  quantity: number;
  thesis: string;
  invalidation: string;
  checklist: string[];
  action: DecisionAction;
  status: DecisionStatus;
  reviewAt: string;
  outcome: DecisionOutcome;
  reviewNote: string;
  marketSource: string;
  marketFetchedAt: string;
  updatedAt: string;
};
