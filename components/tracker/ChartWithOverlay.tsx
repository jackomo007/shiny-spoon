"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useLayoutEffect, useState } from "react";

type OverlaySnapshot = {
  symbol: string;
  exchange: string;
  timeframe: string;
  priceClose: number;
  priceDiff: number;
  pricePct: number;
  high: number;
  low: number;
  volumeLast: number;
  avgVol30: number;
  createdAt: string;
};

type Props = {
  imageUrl: string;
  symbol: string;
  timeframe: "h1" | "h4" | "d1";
  panelWidth?: number;
  title?: string;
  snapshot?: OverlaySnapshot;
};

type Ticker24h = {
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
};

type Kline = [number, string, string, string, string, string, number, string, number, string, string, string];

export default function ChartWithOverlay({
  imageUrl,
  symbol,
  timeframe,
  panelWidth = 280,
  title,
  snapshot,
}: Props) {
  const [ticker, setTicker] = useState<Ticker24h | null>(null);
  const [avgVolState, setAvgVolState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [minP, setMinP] = useState<number | null>(null);
  const [maxP, setMaxP] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapH, setWrapH] = useState(0);

  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => setWrapH(e.contentRect.height));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const binanceInterval = useMemo(() => {
    if (timeframe === "h1") return "1h";
    if (timeframe === "h4") return "4h";
    return "1d";
  }, [timeframe]);

  const hasSnapshot = !!snapshot;

  useEffect(() => {
    if (!hasSnapshot) {
      const cancelledRef = { value: false };
      async function load() {
        try {
          const [tRes, kRes] = await Promise.all([
            fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`),
            fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${binanceInterval}&limit=150`),
          ]);
          if (!tRes.ok) throw new Error("ticker 24h failed");
          if (!kRes.ok) throw new Error("klines failed");
          const tJson = (await tRes.json()) as Ticker24h;
          const kJson = (await kRes.json()) as Kline[];
          const vols = kJson.map(k => Number(k[5]));
          const volAvg = vols.slice(-30).reduce((s, v) => s + v, 0) / Math.max(1, Math.min(30, vols.length));
          const lows = kJson.map(k => Number(k[3]));
          const highs = kJson.map(k => Number(k[2]));
          if (!cancelledRef.value) {
            setTicker(tJson);
            setAvgVolState(volAvg);
            setMinP(Math.min(...lows));
            setMaxP(Math.max(...highs));
            setLoading(false);
          }
        } catch {
          if (!cancelledRef.value) setLoading(false);
        }
      }
      load();
      const id = setInterval(load, 20000);
      return () => {
        cancelledRef.value = true;
        clearInterval(id);
      };
    }
  }, [hasSnapshot, symbol, binanceInterval]);

  useEffect(() => {
    if (hasSnapshot) {
      const cancelledRef = { value: false };
      async function loadRange() {
        try {
          const kRes = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${binanceInterval}&limit=150`
          );
          if (!kRes.ok) throw new Error("klines failed");
          const kJson = (await kRes.json()) as Kline[];
          const lows = kJson.map(k => Number(k[3]));
          const highs = kJson.map(k => Number(k[2]));
          if (!cancelledRef.value) {
            setMinP(Math.min(...lows));
            setMaxP(Math.max(...highs));
            setLoading(false);
          }
        } catch {
          if (!cancelledRef.value) setLoading(false);
        }
      }
      loadRange();
      const id = setInterval(loadRange, 60000);
      return () => {
        cancelledRef.value = true;
        clearInterval(id);
      };
    }
  }, [hasSnapshot, symbol, binanceInterval]);

  const last = hasSnapshot ? snapshot!.priceClose : ticker ? Number(ticker.lastPrice) : null;
  const diff = hasSnapshot ? snapshot!.priceDiff : ticker ? Number(ticker.priceChange) : null;
  const pct = hasSnapshot ? snapshot!.pricePct : ticker ? Number(ticker.priceChangePercent) : null;
  const high = hasSnapshot ? snapshot!.high : ticker ? Number(ticker.highPrice) : null;
  const low = hasSnapshot ? snapshot!.low : ticker ? Number(ticker.lowPrice) : null;
  const vol = hasSnapshot ? snapshot!.volumeLast : ticker ? Number(ticker.volume) : null;
  const avgVol = hasSnapshot ? snapshot!.avgVol30 : avgVolState;

  const up = pct !== null && pct !== undefined ? pct >= 0 : true;
  const exchangeName = hasSnapshot ? snapshot!.exchange : "Binance";
  const tfLabel = hasSnapshot ? snapshot!.timeframe.toUpperCase() : timeframe.toUpperCase();

  function fmt(n?: number | null) {
    if (n === null || n === undefined || Number.isNaN(n)) return "-";
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  function fmtCompact(n?: number | null) {
    if (n === null || n === undefined || Number.isNaN(n)) return "-";
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
    if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
    if (abs >= 1_000) return (n / 1_000).toFixed(2) + "K";
    return n.toFixed(2);
  }

  const PADDING = 48;
  const plotH = Math.max(0, wrapH - PADDING * 2);
  function priceToYPx(price?: number | null) {
    if (price == null || minP == null || maxP == null || plotH <= 0) return null;
    const range = Math.max(1e-9, maxP - minP);
    return PADDING + ((maxP - price) / range) * plotH;
  }
  const yPx = priceToYPx(last);

  const gridLines = 5;
  const rightTicks = useMemo(() => {
    if (minP == null || maxP == null || plotH <= 0) return [] as { y: number; label: string }[];
    const range = Math.max(1e-9, maxP - minP);
    const arr: { y: number; label: string }[] = [];
    for (let i = 0; i <= gridLines; i++) {
      const y = PADDING + (plotH * i) / gridLines;
      const val = maxP - (range * i) / gridLines;
      arr.push({ y, label: val.toLocaleString(undefined, { maximumFractionDigits: 2 }) });
    }
    return arr;
  }, [minP, maxP, plotH]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-xl shadow"
      style={{ background: "#fff" }}
      aria-busy={loading}
    >
      <Image
        src={imageUrl}
        alt={`${symbol} ${timeframe}`}
        width={1280}
        height={720}
        className="block w-full h-auto select-none"
        priority
      />

      <div className="pointer-events-none absolute inset-0">
        {rightTicks.map((t, i) => (
          <div key={i}>
            <div
              className="absolute h-px w-2 bg-gray-300"
              style={{ top: t.y, right: panelWidth }}
            />
            <div
              className="absolute rounded bg-white/70 px-1 text-[11px] leading-none text-gray-500"
              style={{ top: t.y - 7, right: panelWidth + 6 }}
            >
              {t.label}
            </div>
          </div>
        ))}

        {yPx !== null && last !== null && (
          <div
            className="absolute flex select-none items-center gap-2"
            style={{ top: yPx, right: panelWidth + 8, transform: "translateY(-50%)" }}
            aria-hidden
          >
            <div className="h-px w-6 bg-gray-300" />
            <span className={`rounded px-2 py-0.5 text-sm font-medium text-white ${up ? "bg-green-600" : "bg-red-600"}`}>
              {fmt(last)} USDT
            </span>
          </div>
        )}
      </div>

      <div className="absolute left-3 top-3 rounded bg-white/80 px-2 py-1 text-sm font-semibold backdrop-blur">
        {title ?? `${symbol} · ${timeframe.toUpperCase()}`}
      </div>

      <aside
        className="absolute right-0 top-0 bottom-0 border-l p-4"
        style={{
          width: panelWidth,
          background: "rgba(248, 250, 252, 0.92)",
          backdropFilter: "blur(6px)",
          borderColor: "#e5e7eb",
        }}
        aria-label="Market details"
      >
        <div className="text-[15px] font-bold text-gray-900">{symbol.replace(/USDT$/i, "")}/USDT</div>
        <div className="text-sm text-gray-600">Exchange: {exchangeName}</div>
        <div className="mb-2 text-sm text-gray-600">Timeframe: {tfLabel}</div>
        <div className={`text-2xl font-bold ${up ? "text-green-600" : "text-red-600"}`}>{fmt(last)} USDT</div>
        <div className={`${up ? "text-green-600" : "text-red-600"} mb-2`}>
          {diff === null || diff === undefined ? "-" : `${diff >= 0 ? "+" : ""}${fmt(diff)}`} (
          {pct === null || pct === undefined ? "-" : `${pct.toFixed(2)}%`})
        </div>
        <div className="text-sm text-gray-700">
          <div>High: {fmt(high)}</div>
          <div>Low: {fmt(low)}</div>
          <div>Volume: {fmtCompact(vol)}</div>
          <div>Avg Vol (30): {fmtCompact(avgVol)}</div>
        </div>
        {hasSnapshot && (
          <div className="mt-3 text-xs text-gray-500">Capturado em: {new Date(snapshot!.createdAt).toLocaleString()}</div>
        )}
        {!hasSnapshot && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <span
              className="inline-block rounded-full"
              style={{ width: 8, height: 8, background: "#22c55e", boxShadow: "0 0 0 2px #d1fae5" }}
              aria-hidden
            />
            Market open
          </div>
        )}
      </aside>
    </div>
  );
}
