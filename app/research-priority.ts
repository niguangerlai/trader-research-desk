import type { Asset } from "./types";

export type ResearchPriority = "urgent" | "review" | "current";

export type ResearchQueueItem = {
  assetId: string;
  symbol: string;
  name: string;
  priority: ResearchPriority;
  score: number;
  ageDays: number | null;
  negativeSignals: number;
  warningSignals: number;
  invalidatedClaims: number;
  reasons: string[];
  nextStep: string;
};

const PRIORITY_RANK: Record<ResearchPriority, number> = {
  urgent: 3,
  review: 2,
  current: 1,
};

function dateOnlyMilliseconds(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const milliseconds = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

export function researchAgeDays(updatedAt: string, asOfDate: string) {
  const updated = dateOnlyMilliseconds(updatedAt);
  const asOf = dateOnlyMilliseconds(asOfDate);
  if (updated === null || asOf === null) return null;
  return Math.max(0, Math.floor((asOf - updated) / 86_400_000));
}

function staleScore(ageDays: number | null) {
  if (ageDays === null) return 24;
  if (ageDays >= 45) return 30;
  if (ageDays >= 21) return 22;
  if (ageDays >= 10) return 14;
  if (ageDays >= 5) return 6;
  return 0;
}

export function scoreResearchPriority(
  asset: Asset,
  asOfDate: string,
): ResearchQueueItem {
  const ageDays = researchAgeDays(asset.updatedAt, asOfDate);
  const negativeSignals = asset.fundamentalSignals.filter(
    (signal) => signal.state === "negative",
  ).length;
  const warningSignals = asset.fundamentalSignals.filter(
    (signal) => signal.state === "warning",
  ).length;
  const invalidatedClaims =
    asset.lastComparison?.verdicts.filter(
      (item) => item.verdict === "invalidated",
    ).length ?? 0;

  let score = staleScore(ageDays);
  if (asset.status === "holding") score += 35;
  if (asset.category === "unclassified") score += 18;
  if (asset.category === "type3") score += 12;
  if (asset.category === "type2") score += 5;
  if (asset.conviction === "pending") score += 6;
  score += Math.min(negativeSignals * 12, 24);
  score += Math.min(warningSignals * 4, 12);
  score += Math.min(invalidatedClaims * 15, 30);

  const priority: ResearchPriority =
    (asset.status === "holding" && (ageDays === null || ageDays >= 7)) ||
    negativeSignals > 0 ||
    invalidatedClaims > 0 ||
    (ageDays !== null && ageDays >= 30)
      ? "urgent"
      : ageDays === null ||
          ageDays >= 10 ||
          warningSignals > 0 ||
          asset.category === "unclassified" ||
          asset.category === "type3"
        ? "review"
        : "current";

  const reasons: string[] = [];
  if (asset.status === "holding") reasons.push("持仓优先");
  if (ageDays === null) {
    reasons.push("更新时间无法识别");
  } else if (ageDays >= 7) {
    reasons.push(`研究已 ${ageDays} 天未更新`);
  }
  if (negativeSignals) reasons.push(`${negativeSignals} 项负向信号`);
  if (warningSignals) reasons.push(`${warningSignals} 项观察信号`);
  if (invalidatedClaims) reasons.push(`${invalidatedClaims} 项旧判断被证伪`);
  if (asset.category === "unclassified") reasons.push("仍待分类");
  if (!reasons.length) reasons.push("逻辑仍在有效期内");

  return {
    assetId: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    priority,
    score,
    ageDays,
    negativeSignals,
    warningSignals,
    invalidatedClaims,
    reasons,
    nextStep:
      priority === "urgent"
        ? "先更新逻辑，再考虑交易"
        : priority === "review"
          ? "复核信号与价格确认"
          : "继续观察，不必强行动",
  };
}

export function buildResearchQueue(assets: Asset[], asOfDate: string) {
  return assets
    .map((asset) => scoreResearchPriority(asset, asOfDate))
    .sort(
      (left, right) =>
        right.score - left.score ||
        PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority] ||
        left.symbol.localeCompare(right.symbol),
    );
}

