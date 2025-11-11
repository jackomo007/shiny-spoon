"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import { MoneyInputStandalone } from "@/components/form/MaskedFields";
import AssetAutocomplete from "@/components/trade-analyzer/AssetAutocomplete";

function toStringSafe(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

type ApiSuccess = {
  id: string;
  analysis: string;
  createdAt: string;
};

type ApiError = { error: string | unknown };

type StrategyOpt = { id: string; name: string | null };

function isApiSuccess(x: unknown): x is ApiSuccess {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.analysis === "string" &&
    typeof o.createdAt === "string"
  );
}

function isApiError(x: unknown): x is ApiError {
  return typeof x === "object" && x !== null && "error" in (x as Record<string, unknown>);
}

export default function TradeAnalyzerClient({ strategies: _strategies }: { strategies?: StrategyOpt[] } = {}) {
  const [asset, setAsset] = useState("");
  const [amountSpentRaw, setAmountSpentRaw] = useState<string>("");
  const [entryRaw, setEntryRaw] = useState<string>("");
  const [takeProfitRaw, setTakeProfitRaw] = useState<string>("");
  const [stopRaw, setStopRaw] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");

  const amountNum = amountSpentRaw === "" ? NaN : Number(amountSpentRaw);
  const entryNum = entryRaw === "" ? NaN : Number(entryRaw);
  const tpNum = takeProfitRaw === "" ? NaN : Number(takeProfitRaw);
  const stopNum = stopRaw === "" ? NaN : Number(stopRaw);

  const hasAsset = asset.trim().length >= 2;
  const hasAmount = Number.isFinite(amountNum) && amountNum > 0;
  const hasEntry = Number.isFinite(entryNum) && entryNum > 0;
  const hasTP = Number.isFinite(tpNum) && tpNum > 0;
  const hasSL = Number.isFinite(stopNum) && stopNum > 0;

  const isValid = hasAsset && hasAmount && hasEntry && hasTP && hasSL;

  async function submit() {
    if (!isValid) {
      const msgs: string[] = [];
      if (!hasAsset) msgs.push("Asset must be provided (min 2 chars).");
      if (!hasAmount) msgs.push("Amount Spent must be > 0.");
      if (!hasEntry) msgs.push("Entry Price must be > 0.");
      if (!hasTP) msgs.push("Take Profit Price must be > 0.");
      if (!hasSL) msgs.push("Stop Loss Price must be > 0.");
      alert(msgs.join("\n"));
      return;
    }

    setLoading(true);
    setAnalysis("");

    try {
      const payload = {
        asset: asset.trim().toUpperCase(),
        amount_spent: Number(amountSpentRaw),
        entry_price: Number(entryRaw),
        take_profit_price: Number(takeProfitRaw),
        stop_price: Number(stopRaw),
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
          ? typeof (json as ApiError).error === "string"
            ? (json as ApiError).error
            : JSON.stringify((json as ApiError).error)
          : `HTTP ${res.status}${text ? ` - ${text}` : ""}`;
        throw new Error(toStringSafe(msg));
      }

      if (!isApiSuccess(json)) {
        throw new Error(toStringSafe("Invalid response shape from server"));
      }

      setAnalysis(json.analysis);
    } catch (err) {
      const msg = err instanceof Error ? err.message : toStringSafe(err);
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
            <label className="text-sm text-gray-600">Asset</label>
            <AssetAutocomplete value={asset} onChange={setAsset} />
          </div>

          <div>
            <label className="text-sm text-gray-600">Amount Spent (USD)</label>
            <MoneyInputStandalone
              valueRaw={amountSpentRaw}
              onChangeRaw={setAmountSpentRaw}
              placeholder="0"
              className="w-full rounded-xl border p-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Entry Price (USD)</label>
            <MoneyInputStandalone
              valueRaw={entryRaw}
              onChangeRaw={setEntryRaw}
              maxDecimals={8}
              placeholder="0"
              className="w-full rounded-xl border p-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Take Profit Price (USD)</label>
            <MoneyInputStandalone
              valueRaw={takeProfitRaw}
              onChangeRaw={setTakeProfitRaw}
              maxDecimals={8}
              placeholder="0"
              className="w-full rounded-xl border p-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Stop Loss Price (USD)</label>
            <MoneyInputStandalone
              valueRaw={stopRaw}
              onChangeRaw={setStopRaw}
              maxDecimals={8}
              placeholder="0"
              className="w-full rounded-xl border p-2"
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

      {analysis && (
        <Card>
          <div className="text-lg font-semibold mb-3">Result</div>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">{analysis}</pre>
        </Card>
      )}
    </div>
  );
}
