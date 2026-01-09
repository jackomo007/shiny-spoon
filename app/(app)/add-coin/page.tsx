// app/add-coin/page.tsx
"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { Table, Th, Tr, Td } from "@/components/ui/Table";
import AssetAutocomplete from "@/components/trade-analyzer/AssetAutocomplete";

type PriceLevel = {
  level: number;
  kind: "support" | "resistance";
  label?: string;
  confidence?: number;
  notes?: string;
};

type NextLevel = PriceLevel | null;

type CoinRow = {
  id: string;
  asset_symbol: string;
  exchange: string;
  timeframe: string;
  last_price: number;
  last_price_at: string;
  nextSupport: NextLevel;
  nextResistance: NextLevel;
};

type DetailResponse = {
  id: string;
  asset_symbol: string;
  exchange: string;
  timeframe: string;
  last_price: number;
  last_price_at: string;
  structure: {
    supports: PriceLevel[];
    resistances: PriceLevel[];
  };
};

export default function AddCoinPage() {
  const [items, setItems] = useState<CoinRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  async function loadList(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch("/api/add-coin/coins", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { items?: CoinRow[] };
      setItems(json.items ?? []);
    } catch (error) {
      console.error("[AddCoin] load list failed", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function openDetails(id: string): Promise<void> {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/add-coin/coins/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DetailResponse;
      setDetail(json);
    } catch (error) {
      console.error("[AddCoin] load detail failed", error);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, []);

  const hasItems = items.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold"></h1>
        <button
          type="button"
          className="rounded-lg px-3 py-2 border shadow bg-white cursor-pointer"
          onClick={() => setShowAdd(true)}
        >
          + Add Coin
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border bg-white p-6">
          <div className="h-6 w-40 rounded bg-gray-100 animate-pulse mb-4" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-gray-100 animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-gray-100 animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
          </div>
        </div>
      )}

      {!loading && !hasItems && (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-purple-100 grid place-items-center text-purple-600 text-xl">
            🧭
          </div>
          <h3 className="text-lg font-semibold">Track your first coin</h3>
          <p className="text-sm text-gray-600 mt-1">
            Add a coin to see its high timeframe supports &amp; resistances,
            with ideas for swing trades and future alerts.
          </p>
          <button
            className="mt-4 rounded-lg bg-black text-white px-4 py-2 cursor-pointer"
            onClick={() => setShowAdd(true)}
          >
            Add coin
          </button>
        </div>
      )}

      {hasItems && !loading && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <Tr>
                  <Th>Coin</Th>
                  <Th>Price</Th>
                  <Th>Next Resistance</Th>
                  <Th>Next Support</Th>
                  <Th>Actions</Th>
                </Tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <div className="font-medium">{row.asset_symbol}</div>
                      <div className="text-xs text-gray-500">
                        {row.exchange} · {row.timeframe}
                      </div>
                    </Td>
                    <Td>
                      $
                      {row.last_price.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </Td>
                    <Td>
                      {row.nextResistance
                        ? `$${row.nextResistance.level.toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}`
                        : "—"}
                    </Td>
                    <Td>
                      {row.nextSupport
                        ? `$${row.nextSupport.level.toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}`
                        : "—"}
                    </Td>
                    <Td>
                      <button
                        type="button"
                        className="text-sm underline cursor-pointer"
                        onClick={() => void openDetails(row.id)}
                      >
                        View Details
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {showAdd && (
        <AddCoinModal
          onClose={() => {
            setShowAdd(false);
            void loadList();
          }}
        />
      )}

      {detailId && (
        <DetailsModal
          open={detailId !== null}
          loading={detailLoading}
          detail={detail}
          onClose={() => {
            setDetailId(null);
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}

function AddCoinModal({ onClose }: { onClose: () => void }) {
  const [symbol, setSymbol] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  const canSave = symbol.trim().length >= 2 && !saving;

  async function handleSave(): Promise<void> {
    if (!canSave) return;

    try {
      setSaving(true);
      const res = await fetch("/api/add-coin/coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `HTTP ${res.status}`);
      }

      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add coin";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">Add Coin</h3>

        <div className="space-y-2">
          <label className="text-sm text-gray-700">Asset</label>
          <AssetAutocomplete value={symbol} onChange={setSymbol} />
          <p className="text-xs text-gray-500">
            Choose a symbol (e.g. BTC). We&apos;ll fetch daily price action
            and generate high timeframe supports &amp; resistances.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-lg border cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border bg-black text-white disabled:opacity-50 cursor-pointer"
            disabled={!canSave}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailsModal({
  open,
  loading,
  detail,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  detail: DetailResponse | null;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"structure" | "ideas" | "news">(
    "structure",
  );

  if (!open) return null;

  const supports = detail?.structure.supports ?? [];
  const resistances = detail?.structure.resistances ?? [];

  return (
    <div className="fixed inset-0 bg-black/60 p-4 overflow-y-auto z-50">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {detail?.asset_symbol ?? "Loading…"}
            </h3>
            {detail && (
              <div className="text-xs text-gray-500">
                {detail.exchange} · {detail.timeframe} · Price: $
                {detail.last_price.toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            className="px-3 py-1 rounded border cursor-pointer"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex border-b gap-4 text-sm">
          <button
            type="button"
            className={`pb-2 ${
              activeTab === "structure"
                ? "border-b-2 border-black font-semibold"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab("structure")}
          >
            Price Structure
          </button>
          <button
            type="button"
            className={`pb-2 ${
              activeTab === "ideas"
                ? "border-b-2 border-black font-semibold"
                : "text-gray-400"
            }`}
            onClick={() => setActiveTab("ideas")}
          >
            Swing Ideas (soon)
          </button>
          <button
            type="button"
            className={`pb-2 ${
              activeTab === "news"
                ? "border-b-2 border-black font-semibold"
                : "text-gray-400"
            }`}
            onClick={() => setActiveTab("news")}
          >
            News Alerts (soon)
          </button>
        </div>

        {loading && (
          <div className="text-sm text-gray-500">Loading details…</div>
        )}

        {!loading && detail && activeTab === "structure" && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <div className="text-sm font-semibold mb-2">
                Resistances (HTF)
              </div>
              <div className="space-y-2 text-sm">
                {resistances.length === 0 && (
                  <div className="text-gray-500 text-xs">
                    No resistances found.
                  </div>
                )}
                {resistances.map((r, idx) => (
                  <div
                    key={`${r.level}-${idx}`}
                    className="rounded-lg border px-3 py-2 bg-red-50 border-red-200"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        $
                        {r.level.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}
                      </span>
                      {typeof r.confidence === "number" && (
                        <span className="text-xs text-gray-600">
                          Conf: {r.confidence}/5
                        </span>
                      )}
                    </div>
                    {r.label && (
                      <div className="text-xs text-gray-700 mt-1">
                        {r.label}
                      </div>
                    )}
                    {r.notes && (
                      <div className="text-xs text-gray-500 mt-1">
                        {r.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="text-sm font-semibold mb-2">Supports (HTF)</div>
              <div className="space-y-2 text-sm">
                {supports.length === 0 && (
                  <div className="text-gray-500 text-xs">
                    No supports found.
                  </div>
                )}
                {supports.map((s, idx) => (
                  <div
                    key={`${s.level}-${idx}`}
                    className="rounded-lg border px-3 py-2 bg-green-50 border-green-200"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        $
                        {s.level.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}
                      </span>
                      {typeof s.confidence === "number" && (
                        <span className="text-xs text-gray-600">
                          Conf: {s.confidence}/5
                        </span>
                      )}
                    </div>
                    {s.label && (
                      <div className="text-xs text-gray-700 mt-1">
                        {s.label}
                      </div>
                    )}
                    {s.notes && (
                      <div className="text-xs text-gray-500 mt-1">
                        {s.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {!loading && !detail && (
          <div className="text-sm text-gray-500">No data.</div>
        )}
      </div>
    </div>
  );
}
