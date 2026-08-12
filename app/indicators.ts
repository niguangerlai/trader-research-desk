import type {
  IndicatorLinePoint,
  IndicatorMarker,
  MarketBar,
  TraderCIndicatorResult,
} from "./types";

const MOMENTUM_THRESHOLD = 0.6;
const VOLATILITY_LOOKBACK = 50;
const CHANNEL_LOOKBACK = 20;

function ema(values: number[], period: number) {
  const multiplier = 2 / (period + 1);
  const output: Array<number | undefined> = [];
  let current: number | undefined;

  values.forEach((value, index) => {
    if (index < period - 1) {
      output.push(undefined);
      return;
    }
    if (current === undefined) {
      current =
        values.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
    } else {
      current = value * multiplier + current * (1 - multiplier);
    }
    output.push(current);
  });

  return output;
}

function simpleMovingAverage(values: number[], period: number) {
  return values.map((_, index) => {
    if (index < period - 1) return undefined;
    const window = values.slice(index - period + 1, index + 1);
    return window.reduce((sum, value) => sum + value, 0) / period;
  });
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function toLine(
  bars: MarketBar[],
  values: Array<number | undefined>,
): IndicatorLinePoint[] {
  return values.flatMap((value, index) =>
    value === undefined || !Number.isFinite(value)
      ? []
      : [{ time: bars[index].time, value }],
  );
}

export function calculateTraderCFramework(
  bars: MarketBar[],
): TraderCIndicatorResult {
  if (bars.length < 55) {
    return {
      ema20: [],
      ema50: [],
      channelUpper: [],
      channelLower: [],
      channelMid: [],
      vwap20: [],
      markers: [],
      snapshot: null,
    };
  }

  const closes = bars.map((bar) => bar.close);
  const ema20Values = ema(closes, 20);
  const ema50Values = ema(closes, 50);
  const trueRanges = bars.map((bar, index) => {
    if (index === 0) return bar.high - bar.low;
    const previousClose = bars[index - 1].close;
    return Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - previousClose),
      Math.abs(bar.low - previousClose),
    );
  });
  const atr14 = simpleMovingAverage(trueRanges, 14);

  const channelUpper: Array<number | undefined> = [];
  const channelLower: Array<number | undefined> = [];
  const channelMid: Array<number | undefined> = [];
  const vwap20: Array<number | undefined> = [];
  const volatilityRatios: Array<number | undefined> = [];
  const stateKeys: string[] = [];
  const markers: IndicatorMarker[] = [];

  bars.forEach((bar, index) => {
    if (index < CHANNEL_LOOKBACK - 1) {
      channelUpper.push(undefined);
      channelLower.push(undefined);
      channelMid.push(undefined);
      vwap20.push(undefined);
    } else {
      const window = bars.slice(index - CHANNEL_LOOKBACK + 1, index + 1);
      const upper = Math.max(...window.map((item) => item.high));
      const lower = Math.min(...window.map((item) => item.low));
      const volume = window.reduce((sum, item) => sum + item.volume, 0);
      const weighted = window.reduce(
        (sum, item) =>
          sum + ((item.high + item.low + item.close) / 3) * item.volume,
        0,
      );
      channelUpper.push(upper);
      channelLower.push(lower);
      channelMid.push((upper + lower) / 2);
      vwap20.push(volume > 0 ? weighted / volume : undefined);
    }

    const atr = atr14[index];
    volatilityRatios.push(
      atr && bar.close > 0 ? (atr / bar.close) * 100 : undefined,
    );
  });

  const snapshots = bars.map((bar, index) => {
    const atr = atr14[index];
    const fast = ema20Values[index];
    const slow = ema50Values[index];
    const score =
      atr && fast !== undefined && slow !== undefined
        ? (fast - slow) / atr
        : 0;
    const momentum =
      score > MOMENTUM_THRESHOLD && fast !== undefined && bar.close >= fast
        ? "向上"
        : score < -MOMENTUM_THRESHOLD &&
            fast !== undefined &&
            bar.close <= fast
          ? "向下"
          : "均衡";

    const ratio = volatilityRatios[index];
    const volatilityWindow = volatilityRatios
      .slice(Math.max(0, index - VOLATILITY_LOOKBACK + 1), index + 1)
      .filter((value): value is number => value !== undefined);
    const baseline =
      volatilityWindow.length >= 20 ? median(volatilityWindow) : undefined;
    const volatility =
      ratio !== undefined && baseline !== undefined && ratio > baseline * 1.2
        ? "宽幅"
        : ratio !== undefined &&
            baseline !== undefined &&
            ratio < baseline * 0.8
          ? "窄幅"
          : "常态";

    const recent = bars.slice(Math.max(0, index - 9), index + 1);
    const prior = bars.slice(Math.max(0, index - 19), Math.max(0, index - 9));
    const recentHigh = recent.length
      ? Math.max(...recent.map((item) => item.high))
      : bar.high;
    const recentLow = recent.length
      ? Math.min(...recent.map((item) => item.low))
      : bar.low;
    const priorHigh = prior.length
      ? Math.max(...prior.map((item) => item.high))
      : recentHigh;
    const priorLow = prior.length
      ? Math.min(...prior.map((item) => item.low))
      : recentLow;
    const structure =
      prior.length < 10
        ? "混合"
        : recentHigh > priorHigh && recentLow > priorLow
          ? "HH + HL"
          : recentHigh < priorHigh && recentLow < priorLow
            ? "LH + LL"
            : "混合";

    const upper = channelUpper[index];
    const lower = channelLower[index];
    const channelSpan =
      upper !== undefined && lower !== undefined ? upper - lower : 0;
    const position =
      upper !== undefined && lower !== undefined && channelSpan > 0
        ? (bar.close - lower) / channelSpan
        : 0.5;
    const channelPosition =
      position >= 0.67 ? "上沿" : position <= 0.33 ? "下沿" : "中部";
    const regime = `${volatility}${momentum === "均衡" ? "震荡" : momentum === "向上" ? "上行" : "下行"}`;

    return {
      asOf: bar.time,
      momentum,
      momentumScore: score,
      volatility,
      structure,
      channelPosition,
      regime,
    } as const;
  });

  snapshots.forEach((snapshot, index) => {
    const stateKey = `${snapshot.momentum}-${snapshot.volatility}`;
    stateKeys.push(stateKey);
    if (index < 50 || stateKeys[index - 1] === stateKey) return;
    markers.push({
      time: bars[index].time,
      position: snapshot.momentum === "向下" ? "aboveBar" : "belowBar",
      shape:
        snapshot.momentum === "向上"
          ? "arrowUp"
          : snapshot.momentum === "向下"
            ? "arrowDown"
            : "circle",
      text: snapshot.regime,
      tone:
        snapshot.momentum === "向上"
          ? "positive"
          : snapshot.momentum === "向下"
            ? "negative"
            : "neutral",
    });
  });

  return {
    ema20: toLine(bars, ema20Values),
    ema50: toLine(bars, ema50Values),
    channelUpper: toLine(bars, channelUpper),
    channelLower: toLine(bars, channelLower),
    channelMid: toLine(bars, channelMid),
    vwap20: toLine(bars, vwap20),
    markers: markers.slice(-12),
    snapshot: snapshots.at(-1) ?? null,
  };
}
