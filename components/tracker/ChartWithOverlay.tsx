"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type OverlaySnapshot = {
  symbol: string
  exchange: string
  timeframe: string 
  priceClose: number
  priceDiff: number
  pricePct: number
  high: number
  low: number
  volumeLast: number
  avgVol30: number
  createdAt: string
}

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

  const binanceInterval = useMemo(() => {
    if (timeframe === "h1") return "1h";
    if (timeframe === "h4") return "4h";
    return "1d";
  }, [timeframe]);

  const hasSnapshot = !!snapshot;

  useEffect(() => {
    if (hasSnapshot) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const tRes = await fetch(
          `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`
        );
        if (!tRes.ok) throw new Error("ticker 24h failed");
        const tJson = (await tRes.json()) as Ticker24h;

        const kRes = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${binanceInterval}&limit=30`
        );
        if (!kRes.ok) throw new Error("klines failed");
        const kJson = (await kRes.json()) as Kline[];
        const volAvg =
          kJson.reduce((sum, k) => sum + Number(k[5]), 0) /
          Math.max(1, Math.min(30, kJson.length));

        if (!cancelled) {
          setTicker(tJson);
          setAvgVolState(volAvg);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [hasSnapshot, symbol, binanceInterval]);

  const last = hasSnapshot ? snapshot!.priceClose : (ticker ? Number(ticker.lastPrice) : null);
  const diff = hasSnapshot ? snapshot!.priceDiff   : (ticker ? Number(ticker.priceChange) : null);
  const pct  = hasSnapshot ? snapshot!.pricePct    : (ticker ? Number(ticker.priceChangePercent) : null);
  const high = hasSnapshot ? snapshot!.high        : (ticker ? Number(ticker.highPrice) : null);
  const low  = hasSnapshot ? snapshot!.low         : (ticker ? Number(ticker.lowPrice) : null);
  const vol  = hasSnapshot ? snapshot!.volumeLast  : (ticker ? Number(ticker.volume) : null);
  const avgVol = hasSnapshot ? snapshot!.avgVol30  : avgVolState;

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

  return (
    <div
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

      <div className="absolute left-3 top-3 px-2 py-1 text-sm font-semibold rounded bg-white/80 backdrop-blur">
        {title ?? `${symbol} · ${timeframe.toUpperCase()}`}
      </div>

      <aside
        className="absolute top-0 bottom-0 right-0 p-4 border-l"
        style={{
          width: panelWidth,
          background: "rgba(248, 250, 252, 0.92)",
          backdropFilter: "blur(6px)",
          borderColor: "#e5e7eb",
        }}
        aria-label="Market details"
      >
        <div className="text-[15px] font-bold text-gray-900">
          {symbol.replace(/USDT$/i, "")}/USDT
        </div>
        <div className="text-sm text-gray-600">Exchange: {exchangeName}</div>
        <div className="text-sm text-gray-600 mb-2">Timeframe: {tfLabel}</div>

        <div className={`text-2xl font-bold ${up ? "text-green-600" : "text-red-600"}`}>
          {fmt(last)} USDT
        </div>
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
          <div className="mt-3 text-xs text-gray-500">
            Capturado em: {new Date(snapshot!.createdAt).toLocaleString()}
          </div>
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
