"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CandlestickData,
  IChartApi,
  LineData,
  SeriesMarker,
  Time,
} from "lightweight-charts";
import type {
  ChartTimeframe,
  ForecastRecord,
  MarketBar,
  MarketTime,
  TraderCIndicatorResult,
} from "../types";
import {
  formatMarketTime,
  marketTimeToMilliseconds,
} from "../chart-data";

type MarketChartProps = {
  symbol: string;
  bars: MarketBar[];
  indicator: TraderCIndicatorResult;
  forecast?: ForecastRecord;
  showForecast: boolean;
  showIndicators: boolean;
  dataSource: string;
  timeframe: ChartTimeframe;
};

type CrosshairValue = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
} | null;

function readChartColors() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string) => styles.getPropertyValue(name).trim();
  return {
    paper: read("--chart-color-paper"),
    text: read("--chart-color-text"),
    rule: read("--chart-color-rule"),
    accent: read("--chart-color-accent"),
    accentMuted: read("--chart-color-accent-muted"),
    positive: read("--chart-color-positive"),
    negative: read("--chart-color-negative"),
    neutral: read("--chart-color-neutral"),
    inkSoft: read("--chart-color-ink-soft"),
    warning: read("--chart-color-warning"),
    font: getComputedStyle(document.body).fontFamily,
  };
}

function lineData(
  points: Array<{ time: MarketTime; value: number }>,
  start: MarketTime,
): LineData<Time>[] {
  return points
    .filter(
      (point) =>
        marketTimeToMilliseconds(point.time) >=
        marketTimeToMilliseconds(start),
    )
    .map((point) => ({ time: point.time as Time, value: point.value }));
}

function forecastLineData(
  forecast: ForecastRecord | undefined,
  bars: MarketBar[],
) {
  if (!forecast || !forecast.path.length) return [];
  const forecastAsOf = new Date(`${forecast.asOfDate}T23:59:59Z`).getTime();
  const anchor =
    [...bars]
      .reverse()
      .find((bar) => marketTimeToMilliseconds(bar.time) <= forecastAsOf) ??
    bars[0];
  const points = [
    ...(anchor
      ? [{ time: anchor.time as Time, value: anchor.close }]
      : []),
    ...forecast.path
      .filter((point) => point.date > forecast.asOfDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((point) => ({ time: point.date as Time, value: point.price })),
  ];
  return points;
}

export function MarketChart({
  symbol,
  bars,
  indicator,
  forecast,
  showForecast,
  showIndicators,
  dataSource,
  timeframe,
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [crosshair, setCrosshair] = useState<CrosshairValue>(null);

  const latest = bars.at(-1);
  const displayed = crosshair ?? latest ?? null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !bars.length) return;
    let disposed = false;

    import("lightweight-charts").then((charts) => {
      if (disposed || !containerRef.current) return;
      const colors = readChartColors();
      const chart = charts.createChart(containerRef.current, {
        autoSize: true,
        height: 460,
        layout: {
          background: { type: charts.ColorType.Solid, color: colors.paper },
          textColor: colors.text,
          fontFamily: colors.font,
          fontSize: 11,
          attributionLogo: true,
        },
        grid: {
          vertLines: { color: colors.rule },
          horzLines: { color: colors.rule },
        },
        crosshair: {
          mode: charts.CrosshairMode.Normal,
          vertLine: {
            color: colors.inkSoft,
            style: charts.LineStyle.Dashed,
            labelBackgroundColor: colors.inkSoft,
          },
          horzLine: {
            color: colors.inkSoft,
            style: charts.LineStyle.Dashed,
            labelBackgroundColor: colors.inkSoft,
          },
        },
        rightPriceScale: {
          borderColor: colors.rule,
          scaleMargins: { top: 0.08, bottom: 0.12 },
        },
        timeScale: {
          borderColor: colors.rule,
          timeVisible: true,
          rightOffset: 6,
          barSpacing: 7,
          minBarSpacing: 3,
        },
      });
      chartRef.current = chart;

      const candles = chart.addSeries(charts.CandlestickSeries, {
        upColor: colors.positive,
        downColor: colors.negative,
        borderVisible: false,
        wickUpColor: colors.positive,
        wickDownColor: colors.negative,
        priceLineVisible: true,
        lastValueVisible: true,
      });
      candles.setData(
        bars.map(
          (bar): CandlestickData<Time> => ({
            time: bar.time as Time,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          }),
        ),
      );

      const start = bars[0].time;
      const addLine = (
        data: LineData<Time>[],
        options: Parameters<typeof chart.addSeries>[1],
      ) => {
        const series = chart.addSeries(charts.LineSeries, options);
        series.setData(data);
        return series;
      };

      if (showIndicators) {
        addLine(lineData(indicator.ema20, start), {
          color: colors.accent,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          title: "EMA20",
        });
        addLine(lineData(indicator.ema50, start), {
          color: colors.warning,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          title: "EMA50",
        });
        addLine(lineData(indicator.channelUpper, start), {
          color: colors.accentMuted,
          lineWidth: 1,
          lineStyle: charts.LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
          title: "20期上沿",
        });
        addLine(lineData(indicator.channelLower, start), {
          color: colors.accentMuted,
          lineWidth: 1,
          lineStyle: charts.LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
          title: "20期下沿",
        });
        addLine(lineData(indicator.channelMid, start), {
          color: colors.neutral,
          lineWidth: 1,
          lineStyle: charts.LineStyle.Dotted,
          priceLineVisible: false,
          lastValueVisible: false,
          title: "通道中位",
        });
        addLine(lineData(indicator.vwap20, start), {
          color: colors.inkSoft,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          title: "VWAP20",
        });

        const markerColors = {
          positive: colors.positive,
          negative: colors.negative,
          neutral: colors.neutral,
        };
        const markers: SeriesMarker<Time>[] = indicator.markers
          .filter(
            (marker) =>
              marketTimeToMilliseconds(marker.time) >=
              marketTimeToMilliseconds(start),
          )
          .map((marker) => ({
            time: marker.time as Time,
            position: marker.position,
            shape: marker.shape,
            color: markerColors[marker.tone],
            text: marker.text,
            size: 0.8,
          }));
        charts.createSeriesMarkers(candles, markers);
      }

      if (showForecast && forecast) {
        const forecastData = forecastLineData(forecast, bars);
        if (forecastData.length > 1) {
          addLine(forecastData, {
            color: colors.accent,
            lineWidth: 3,
            lineStyle: charts.LineStyle.Dashed,
            priceLineVisible: false,
            lastValueVisible: true,
            title: `预测 ${forecast.asOfDate}`,
          });
        }
        if (forecast.triggerPrice) {
          candles.createPriceLine({
            price: forecast.triggerPrice,
            color: colors.positive,
            lineWidth: 1,
            lineStyle: charts.LineStyle.Dashed,
            axisLabelVisible: true,
            title: "确认",
          });
        }
        if (forecast.invalidationPrice) {
          candles.createPriceLine({
            price: forecast.invalidationPrice,
            color: colors.negative,
            lineWidth: 1,
            lineStyle: charts.LineStyle.Dashed,
            axisLabelVisible: true,
            title: "失效",
          });
        }
      }

      chart.subscribeCrosshairMove((param) => {
        if (!param.time) {
          setCrosshair(null);
          return;
        }
        const value = param.seriesData.get(candles) as
          | CandlestickData<Time>
          | undefined;
        if (!value || !("open" in value)) return;
        setCrosshair({
          time:
            typeof param.time === "string"
              ? param.time
              : "year" in param.time
                ? `${param.time.year}-${String(param.time.month).padStart(2, "0")}-${String(param.time.day).padStart(2, "0")}`
                : formatMarketTime(Number(param.time)),
          open: value.open,
          high: value.high,
          low: value.low,
          close: value.close,
        });
      });

      chart.timeScale().fitContent();
    });

    return () => {
      disposed = true;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [bars, forecast, indicator, showForecast, showIndicators]);

  return (
    <section className="chart-canvas-shell" aria-label={`${symbol} K线图`}>
      <div className="chart-readout">
        <strong>{symbol}</strong>
        {displayed ? (
          <>
            <span>{formatMarketTime(displayed.time)}</span>
            <span>开 {displayed.open.toFixed(2)}</span>
            <span>高 {displayed.high.toFixed(2)}</span>
            <span>低 {displayed.low.toFixed(2)}</span>
            <span>收 {displayed.close.toFixed(2)}</span>
          </>
        ) : (
          <span>等待行情</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="market-chart"
        role="img"
        aria-label={`${symbol} ${timeframe} K线${showIndicators ? "，包含趋势、通道、VWAP与状态标记" : ""}${showForecast ? "，包含预测图层" : ""}`}
      />
      <p className="chart-attribution">
        {timeframe} 数据：{dataSource} · 图表内核：TradingView Lightweight
        Charts
      </p>
    </section>
  );
}
