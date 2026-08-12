import type { Asset, Regime } from "./types";

export const SINGLE_POSITION_MONITOR = 20;
export const THEME_MONITOR = 40;

export type PortfolioPosition = {
  asset: Asset;
  weight: number | null;
  weightSource: "explicit" | "legacy" | "missing";
  theme: string;
  negativeSignals: number;
  warningSignals: number;
};

export type PortfolioBucket = {
  label: string;
  weight: number;
  symbols: string[];
};

export type PortfolioRiskReport = {
  holdings: PortfolioPosition[];
  weightedHoldings: PortfolioPosition[];
  missingHoldings: PortfolioPosition[];
  recordedWeight: number;
  residualWeight: number;
  overAllocatedWeight: number;
  largestPosition: PortfolioPosition | null;
  topThreeWeight: number;
  themes: PortfolioBucket[];
  regimes: PortfolioBucket[];
  negativeSignalWeight: number;
  warningSignalWeight: number;
  type23Weight: number;
  monitoringNotes: string[];
};

const REGIME_LABEL: Record<Regime, string> = {
  type1: "第一类",
  type2: "第二类",
  type3: "第三类",
  unclassified: "待分类",
};

function validWeight(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 100
    ? value
    : null;
}

export function legacyPositionWeight(value: string | undefined) {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (!match) return null;
  return validWeight(Number(match[1]));
}

export function resolvePortfolioWeight(asset: Asset) {
  const explicit = validWeight(asset.portfolioWeight);
  if (explicit !== null) {
    return { weight: explicit, source: "explicit" as const };
  }
  const legacy = legacyPositionWeight(asset.positionSize);
  return legacy !== null
    ? { weight: legacy, source: "legacy" as const }
    : { weight: null, source: "missing" as const };
}

export function inferRiskTheme(asset: Asset) {
  if (asset.riskTheme?.trim()) return asset.riskTheme.trim();
  const evidence = `${asset.symbol} ${asset.name} ${asset.sector}`.toLowerCase();
  if (
    /hbm|dram|nand|ssd|hdd|光模块|数据中心|inp|gaas|半导体|存储|云基础设施/.test(
      evidence,
    )
  ) {
    return "AI 资本开支链";
  }
  if (/指数|大型科技|云计算|广告|搜索/.test(evidence)) {
    return "大型科技 / 久期";
  }
  if (
    /稳定币|金融科技|加密|bitcoin|ethereum|btcusdt|ethusdt|btc-usd|eth-usd/.test(
      evidence,
    )
  ) {
    return "加密流动性";
  }
  if (/贵金属|黄金|白银/.test(evidence)) return "贵金属";
  if (/能源|原油|wti/.test(evidence)) return "能源";
  if (/电信|光网络/.test(evidence)) return "通信设备";
  return "其他 / 待归因";
}

function buckets(
  positions: PortfolioPosition[],
  labelFor: (position: PortfolioPosition) => string,
) {
  const byLabel = new Map<string, PortfolioBucket>();
  for (const position of positions) {
    if (position.weight === null) continue;
    const label = labelFor(position);
    const current = byLabel.get(label) ?? { label, weight: 0, symbols: [] };
    current.weight += position.weight;
    current.symbols.push(position.asset.symbol);
    byLabel.set(label, current);
  }
  return Array.from(byLabel.values()).sort(
    (left, right) => right.weight - left.weight || left.label.localeCompare(right.label),
  );
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildPortfolioRisk(assets: Asset[]): PortfolioRiskReport {
  const holdings = assets
    .filter((asset) => asset.status === "holding")
    .map((asset): PortfolioPosition => {
      const resolved = resolvePortfolioWeight(asset);
      return {
        asset,
        weight: resolved.weight,
        weightSource: resolved.source,
        theme: inferRiskTheme(asset),
        negativeSignals: asset.fundamentalSignals.filter(
          (signal) => signal.state === "negative",
        ).length,
        warningSignals: asset.fundamentalSignals.filter(
          (signal) => signal.state === "warning",
        ).length,
      };
    });
  const weightedHoldings = holdings
    .filter(
      (position): position is PortfolioPosition & { weight: number } =>
        position.weight !== null,
    )
    .sort((left, right) => right.weight - left.weight);
  const missingHoldings = holdings.filter(
    (position) => position.weight === null,
  );
  const recordedWeight = rounded(
    weightedHoldings.reduce((sum, position) => sum + position.weight, 0),
  );
  const themes = buckets(weightedHoldings, (position) => position.theme);
  const regimes = buckets(
    weightedHoldings,
    (position) => REGIME_LABEL[position.asset.category],
  );
  const largestPosition = weightedHoldings[0] ?? null;
  const negativeSignalWeight = rounded(
    weightedHoldings.reduce(
      (sum, position) =>
        sum + (position.negativeSignals > 0 ? position.weight : 0),
      0,
    ),
  );
  const warningSignalWeight = rounded(
    weightedHoldings.reduce(
      (sum, position) =>
        sum + (position.warningSignals > 0 ? position.weight : 0),
      0,
    ),
  );
  const type23Weight = rounded(
    weightedHoldings.reduce(
      (sum, position) =>
        sum +
        (position.asset.category === "type2" ||
        position.asset.category === "type3"
          ? position.weight
          : 0),
      0,
    ),
  );
  const monitoringNotes: string[] = [];
  if (missingHoldings.length) {
    monitoringNotes.push(`${missingHoldings.length} 个持仓尚未录入组合权重`);
  }
  if (recordedWeight > 100) {
    monitoringNotes.push(`已录入权重超过 100%：超出 ${rounded(recordedWeight - 100)}%`);
  }
  if (
    largestPosition &&
    largestPosition.weight !== null &&
    largestPosition.weight >= SINGLE_POSITION_MONITOR
  ) {
    monitoringNotes.push(
      `${largestPosition.asset.symbol} 达到单一标的 ${SINGLE_POSITION_MONITOR}% 监控线`,
    );
  }
  if ((themes[0]?.weight ?? 0) >= THEME_MONITOR) {
    monitoringNotes.push(
      `${themes[0].label} 达到同一故事 ${THEME_MONITOR}% 监控线`,
    );
  }
  if (negativeSignalWeight > 0) {
    monitoringNotes.push(`${negativeSignalWeight}% 权重含负向验证信号`);
  }

  return {
    holdings,
    weightedHoldings,
    missingHoldings,
    recordedWeight,
    residualWeight: rounded(Math.max(0, 100 - recordedWeight)),
    overAllocatedWeight: rounded(Math.max(0, recordedWeight - 100)),
    largestPosition,
    topThreeWeight: rounded(
      weightedHoldings
        .slice(0, 3)
        .reduce((sum, position) => sum + position.weight, 0),
    ),
    themes,
    regimes,
    negativeSignalWeight,
    warningSignalWeight,
    type23Weight,
    monitoringNotes,
  };
}
