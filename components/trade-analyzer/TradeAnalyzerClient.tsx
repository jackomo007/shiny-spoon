"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import ChartWithOverlay from "@/components/tracker/ChartWithOverlay";
import AssetAutocomplete from "@/components/trade-analyzer/AssetAutocomplete";

type StrategyOpt = { id: string; name: string | null };
type TradeType = "spot" | "futures";
type Side = "buy" | "sell" | "long" | "short";

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

type ApiSuccess = {
  id: string;
  imageUrl: string;
  analysis: string;
  createdAt: string;
  snapshot?: OverlaySnapshot | null;
};
type ApiError = { error: string | unknown };

function isApiSuccess(x: unknown): x is ApiSuccess {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.imageUrl === "string" &&
    typeof o.analysis === "string" &&
    typeof o.createdAt === "string"
  );
}
function isApiError(x: unknown): x is ApiError {
  if (typeof x !== "object" || x === null) return false;
  return "error" in x;
}

export default function TradeAnalyzerClient({ strategies }: { strategies: StrategyOpt[] }) {
  const [strategyId, setStrategyId] = useState<string>("");
  const [asset, setAsset] = useState("");
  const [tradeType, setTradeType] = useState<TradeType>("spot");
  const [side, setSide] = useState<Side>("buy");
  const [amountSpent, setAmountSpent] = useState<number>(100);
  const [entry, setEntry] = useState<string>("");
  const [target, setTarget] = useState<number | "">("");
  const [stop, setStop] = useState<number | "">("");
  const [tfCode, setTfCode] = useState<string>("1h");

  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [snapshot, setSnapshot] = useState<OverlaySnapshot | null>(null);

  function ensureSide(t: TradeType) {
    if (t === "spot") setSide("buy");
    if (t === "futures" && (side === "buy" || side === "sell")) setSide("long");
  }

  const entryNum  = entry.trim() === "" ? NaN : Number(entry);
  const amountNum = Number(amountSpent);
  const hasAsset  = asset.trim().length >= 2;
  const hasEntry  = Number.isFinite(entryNum) && entryNum > 0;
  const hasAmount = Number.isFinite(amountNum) && amountNum > 0;
  const isValid   = hasAsset && hasEntry && hasAmount;

  async function submit() {
    if (!isValid) {
      const msgs: string[] = [];
      if (!hasAsset) msgs.push("Asset must be provided (min 2 chars).");
      if (!hasEntry) msgs.push("Entry price must be > 0.");
      if (!hasAmount) msgs.push("Amount spent must be > 0.");
      alert(msgs.join("\n"));
      return;
    }
    setLoading(true);
    setAnalysis("");
    setImageUrl("");
    setSnapshot(null);

    try {
      const payload = {
        strategy_id: strategyId || undefined,
        asset: asset.trim().toUpperCase(),
        trade_type: tradeType,
        side,
        amount_spent: Number(amountSpent),
        entry_price: Number(entry),
        target_price: target === "" ? null : Number(target),
        stop_price: stop === "" ? null : Number(stop),
        timeframe_code: tfCode.trim(),
      };

      const res = await fetch("/api/trade-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      const json: unknown =
        contentType.includes("application/json") && text ? JSON.parse(text) : null;

      if (!res.ok) {
        const msg = isApiError(json)
          ? typeof json.error === "string"
            ? json.error
            : JSON.stringify(json.error)
          : `HTTP ${res.status}${text ? ` - ${text}` : ""}`;
        throw new Error(msg);
      }

      if (!isApiSuccess(json)) {
        throw new Error("Invalid response shape from server");
      }

      setAnalysis(json.analysis);
      setImageUrl(json.imageUrl);
      setSnapshot(json.snapshot ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      {loading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm">
          <div className="rounded-xl bg-white px-6 py-4 shadow">
            <div className="animate-pulse text-sm">Analyzing trade…</div>
          </div>
        </div>
      )}

      <div className="text-2xl font-semibold">Trade Analyzer</div>

      <Card>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-600">Strategy Used</label>
            <select
              className="w-full rounded-xl border p-2"
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
            >
              <option value="">— None —</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? s.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600">Asset</label>
            <AssetAutocomplete value={asset} onChange={setAsset} />
          </div>

          <div>
            <label className="text-sm text-gray-600">Timeframe</label>
            <input
              className="w-full rounded-xl border p-2"
              value={tfCode}
              onChange={(e) => setTfCode(e.target.value)}
              placeholder="e.g., 15m, 1h, 4h, 1d, 1w, 1M"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Trade Type</label>
            <select
              className="w-full rounded-xl border p-2"
              value={tradeType}
              onChange={(e) => {
                const t = e.target.value as TradeType;
                setTradeType(t);
                ensureSide(t);
              }}
            >
              <option value="spot">Spot</option>
              <option value="futures">Futures</option>
            </select>
          </div>

          {tradeType === "futures" && (
            <div>
              <label className="text-sm text-gray-600">Trade Side</label>
              <select
                className="w-full rounded-xl border p-2"
                value={side}
                onChange={(e) => setSide(e.target.value as Side)}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-sm text-gray-600">Amount Spent</label>
            <input
              type="number"
              className="w-full rounded-xl border p-2"
              value={amountSpent}
              onChange={(e) => setAmountSpent(Number(e.target.value))}
              min={0}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Entry Price</label>
            <input
              type="number"
              className="w-full rounded-xl border p-2"
              value={entry}
              onChange={(e) => setEntry(e.currentTarget.value)}
              min={0}
              inputMode="decimal"
              step="any"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Target Exit Price</label>
            <input
              type="number"
              className="w-full rounded-xl border p-2"
              value={target}
              onChange={(e) => setTarget(e.target.value === "" ? "" : Number(e.target.value))}
              min={0}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Stop Loss Price</label>
            <input
              type="number"
              className="w-full rounded-xl border p-2"
              value={stop}
              onChange={(e) => setStop(e.target.value === "" ? "" : Number(e.target.value))}
              min={0}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            disabled={loading || !isValid}
            onClick={submit}
            className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </Card>

      {(imageUrl || analysis) && (
        <Card>
          <div className="text-lg font-semibold mb-3">Result</div>

          {imageUrl && (
            <div className="rounded-xl border mb-4 overflow-hidden">
              <ChartWithOverlay
                imageUrl={imageUrl}
                symbol={asset.toUpperCase()}
                timeframe={["1h", "4h", "d1"].includes(tfCode.toLowerCase()) ? (tfCode.toLowerCase() as "h1"|"h4"|"d1") : "h1"}
                panelWidth={280}
                title={`${asset.toUpperCase()} · ${tfCode.toUpperCase()} (Pre-Trade)`}
                snapshot={snapshot ?? undefined}
              />
            </div>
          )}

          <pre className="whitespace-pre-wrap text-sm leading-relaxed">{analysis}</pre>
        </Card>
      )}
    </div>
  );
}
