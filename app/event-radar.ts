import type { Asset, ResearchEvent } from "./types";

export type EventTiming = "overdue" | "today" | "upcoming";

export type EventRadarItem = {
  assetId: string;
  symbol: string;
  name: string;
  holding: boolean;
  event: ResearchEvent;
  timing: EventTiming;
  daysUntil: number;
};

export type EventRadarSummary = {
  overdue: number;
  next7Days: number;
  inWindow: number;
  conditionalCatalysts: number;
};

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

export function eventDaysUntil(date: string, asOfDate: string) {
  const eventDate = dateOnlyMilliseconds(date);
  const asOf = dateOnlyMilliseconds(asOfDate);
  if (eventDate === null || asOf === null) return null;
  return Math.round((eventDate - asOf) / 86_400_000);
}

export function buildEventRadar(
  assets: Asset[],
  asOfDate: string,
  windowDays = 30,
  reviewLookbackDays = 7,
) {
  const items = assets.flatMap((asset) =>
    (asset.keyEvents ?? []).flatMap((event): EventRadarItem[] => {
      if (event.status !== "scheduled") return [];
      const daysUntil = eventDaysUntil(event.date, asOfDate);
      if (
        daysUntil === null ||
        daysUntil > windowDays ||
        daysUntil < -reviewLookbackDays
      ) {
        return [];
      }
      return [
        {
          assetId: asset.id,
          symbol: asset.symbol,
          name: asset.name,
          holding: asset.status === "holding",
          event,
          timing:
            daysUntil < 0
              ? "overdue"
              : daysUntil === 0
                ? "today"
                : "upcoming",
          daysUntil,
        },
      ];
    }),
  );

  items.sort((left, right) => {
    const leftOverdue = left.daysUntil < 0;
    const rightOverdue = right.daysUntil < 0;
    if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
    const timingOrder = leftOverdue
      ? right.daysUntil - left.daysUntil
      : left.daysUntil - right.daysUntil;
    return (
      timingOrder ||
      Number(right.holding) - Number(left.holding) ||
      ({ high: 3, medium: 2, low: 1 }[right.event.impact] -
        { high: 3, medium: 2, low: 1 }[left.event.impact]) ||
      left.symbol.localeCompare(right.symbol)
    );
  });

  const summary: EventRadarSummary = {
    overdue: items.filter((item) => item.daysUntil < 0).length,
    next7Days: items.filter(
      (item) => item.daysUntil >= 0 && item.daysUntil <= 7,
    ).length,
    inWindow: items.filter((item) => item.daysUntil >= 0).length,
    conditionalCatalysts: assets.reduce(
      (total, asset) => total + asset.catalyst.length,
      0,
    ),
  };

  return { items, summary };
}
