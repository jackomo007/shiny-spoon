"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { MoneyInputStandalone } from "@/components/form/MaskedFields";
import { cls, usd } from "@/components/portfolio/format";
import type { TxRow } from "@/components/portfolio/TransactionsTable";
import { ChevronDown } from "@/components/portfolio/icons";

type AssetPick = {
  id: string;
  symbol: string;
  name: string;
  thumb?: string | null;
  priceUsd?: number | null;
  change24hPct?: number | null;
};

type ChainOption = {
  id: string;
  name: string;
  symbol: string;
};

type Step = "pick" | "form";

type TopAssetsResponse = {
  items: Array<{
    id: string;
    symbol: string;
    name: string;
    image: string | null;
    priceUsd: number | null;
    change24hPct: number | null;
    marketCapRank: number | null;
  }>;
};

type SearchAssetsResponse = {
  items: Array<{
    id: string;
    symbol: string;
    name: string;
    thumb: string | null;
  }>;
};

type PriceResponse = { priceUsd: number; change24hPct: number | null };

export default function AddTransactionModal(props: {
  open: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
  mode?: "add" | "edit";
  initialTx?: TxRow | null;
  initialAsset?: AssetPick | null;
}) {
  const mode = props.mode ?? "add";
  const [step, setStep] = useState<Step>("pick");
  const [top, setTop] = useState<AssetPick[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetPick[]>([]);
  const [selected, setSelected] = useState<AssetPick | null>(null);
  const [chainOptions, setChainOptions] = useState<ChainOption[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string>("");

  const [side, setSide] = useState<"buy" | "sell">("buy");

  const [priceRaw, setPriceRaw] = useState<string>("");

  const [amountRaw, setAmountRaw] = useState<string>("");
  const [totalRaw, setTotalRaw] = useState<string>("");
  const [feeRaw, setFeeRaw] = useState<string>("0");
  const [isStablecoin, setIsStablecoin] = useState(false);
  const [busy, setBusy] = useState(false);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const lastEdited = useRef<"amount" | "total" | null>(null);
  const lastChanged = useRef<"amount" | "total" | "fee" | null>(null);

  function numFromRaw(s: string) {
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  const priceUsd = useMemo(() => numFromRaw(priceRaw), [priceRaw]);

  const totalFromAmount = useCallback((amount: number, price: number) => {
    return amount * price;
  }, []);

  const amountFromTotal = useCallback((total: number, price: number) => {
    return total > 0 ? total / price : 0;
  }, []);

  const hasQuery = query.trim().length > 0;

  function resetAll() {
    setStep("pick");
    setQuery("");
    setResults([]);
    setSelected(null);
    setChainOptions([]);
    setSelectedChainId("");

    setSide("buy");
    setPriceRaw("");

    setAmountRaw("");
    setTotalRaw("");
    setFeeRaw("0");
    setIsStablecoin(false);
    setBusy(false);

    setConfirmDeleteOpen(false);

    lastEdited.current = null;
    lastChanged.current = null;
  }

  useEffect(() => {
    if (!props.open) resetAll();
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    if (mode !== "edit") return;
    if (!props.initialTx) return;

    const t = props.initialTx;

    setStep("form");
    setSide(t.side);
    setPriceRaw(String(t.priceUsd ?? ""));
    setAmountRaw(String(Math.abs(t.qty ?? 0)));
    setTotalRaw(String(Math.abs(t.totalUsd ?? 0)));
    setFeeRaw(String(t.feeUsd ?? 0));
    setIsStablecoin(false);
    lastEdited.current = "total";
    lastChanged.current = null;

    setSelected({
      id: t.coingeckoId ?? t.symbol.toLowerCase(),
      symbol: t.symbol,
      name: t.name ?? t.symbol,
      thumb: t.iconUrl ?? null,
    });
    setSelectedChainId(t.chainId ?? "");
  }, [props.open, mode, props.initialTx]);

  const loadMarketPrice = useCallback(async (id: string) => {
    setConfirmDeleteOpen(false);

    const res = await fetch(
      `/api/portfolio/assets/price?id=${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const j = (await res.json()) as PriceResponse;
    const p = Number(j.priceUsd ?? 0);
    setPriceRaw(p > 0 ? String(p) : "");
  }, []);

  useEffect(() => {
    if (!props.open) return;
    if (mode !== "add") return;
    if (!props.initialAsset) return;

    const asset = props.initialAsset;
    setSelected(asset);
    setSelectedChainId("");
    setStep("form");
    setSide("buy");
    setPriceRaw(
      asset.priceUsd != null && asset.priceUsd > 0
        ? String(asset.priceUsd)
        : "",
    );
    setAmountRaw("");
    setTotalRaw("");
    setFeeRaw("0");
    setIsStablecoin(false);
    lastEdited.current = null;
    lastChanged.current = null;

    if (asset.priceUsd == null || asset.priceUsd <= 0) {
      void loadMarketPrice(asset.id);
    }
  }, [loadMarketPrice, props.open, mode, props.initialAsset]);

  useEffect(() => {
    if (!props.open) return;
    if (!selected) return;

    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/portfolio/assets/chains?id=${encodeURIComponent(selected.id)}&symbol=${encodeURIComponent(selected.symbol)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const json = (await res.json().catch(() => null)) as {
        defaultChainId?: string;
        items?: ChainOption[];
      } | null;
      if (cancelled) return;

      const options = json?.items ?? [];
      setChainOptions(options);
      setSelectedChainId((current) => {
        if (current && options.some((option) => option.id === current)) {
          return current;
        }
        return json?.defaultChainId ?? options[0]?.id ?? "other";
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [props.open, selected]);

  useEffect(() => {
    if (!props.open) return;
    (async () => {
      const res = await fetch("/api/portfolio/assets/top", {
        cache: "no-store",
      });
      if (!res.ok) return;

      const j = (await res.json()) as TopAssetsResponse;
      setTop(
        (j.items ?? []).map((x) => ({
          id: x.id,
          symbol: x.symbol,
          name: x.name,
          thumb: x.image ?? null,
          priceUsd: x.priceUsd ?? null,
          change24hPct: x.change24hPct ?? null,
        })),
      );
    })();
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;

    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }

    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/portfolio/assets/search?q=${encodeURIComponent(q)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;

      const j = (await res.json()) as SearchAssetsResponse;
      setResults(
        (j.items ?? []).map((x) => ({
          id: x.id,
          symbol: x.symbol,
          name: x.name,
          thumb: x.thumb ?? null,
        })),
      );
    }, 250);

    return () => clearTimeout(t);
  }, [query, props.open]);

  function revealConfirmDeleteIfOpen(open: boolean) {
    setConfirmDeleteOpen(open);
  }

  useEffect(() => {
    if (!selected) return;
    if (!priceUsd || priceUsd <= 0) return;
    if (mode === "edit" && lastChanged.current === "fee") return;

    const amount = numFromRaw(amountRaw);
    const total = numFromRaw(totalRaw);

    if (lastEdited.current === "amount") {
      const newTotal = totalFromAmount(amount, priceUsd);
      const next = amount ? String(newTotal) : "";
      setTotalRaw((prev) => (prev === next ? prev : next));
    } else if (lastEdited.current === "total") {
      const newAmount = amountFromTotal(total, priceUsd);
      const next = total ? String(newAmount) : "";
      setAmountRaw((prev) => (prev === next ? prev : next));
    }
  }, [
    priceUsd,
    mode,
    selected,
    amountRaw,
    totalRaw,
    amountFromTotal,
    totalFromAmount,
  ]);

  const canSave =
    !!selected &&
    priceUsd > 0 &&
    (!!amountRaw || !!totalRaw) &&
    numFromRaw(feeRaw) >= 0 &&
    !busy;

  const canDelete =
    mode === "edit" && step !== "pick" && !!props.initialTx?.id && !busy;
  const hasLockedInitialAsset = mode === "add" && !!props.initialAsset;

  async function handleDeleteNow() {
    if (!props.initialTx?.id) return;

    try {
      setBusy(true);

      const res = await fetch(
        `/api/portfolio/transaction/${props.initialTx.id}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        const msg =
          typeof j?.error === "string"
            ? j.error
            : "Failed to delete transaction";
        throw new Error(msg);
      }

      setConfirmDeleteOpen(false);

      await props.onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      alert(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={props.open}
        onClose={() => {
          if (busy) return;
          props.onClose();
        }}
        title={
          step === "pick"
            ? mode === "edit"
              ? "Edit Transaction"
              : "Add Transaction"
            : mode === "edit"
              ? `Edit Transaction • ${selected?.symbol ?? ""}`
              : `Add Transaction • ${selected?.symbol ?? ""}`
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            {canDelete ? (
              <button
                className="cursor-pointer rounded-xl bg-red-500 text-white px-4 py-2 text-sm hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => revealConfirmDeleteIfOpen(true)}
                disabled={!canDelete}
                type="button"
              >
                Delete
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                className="cursor-pointer rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => props.onClose()}
                disabled={busy}
                type="button"
              >
                Cancel
              </button>

              {step === "pick" ? null : (
                <button
                  className="cursor-pointer rounded-xl bg-gray-900 text-white px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canSave}
                  onClick={async () => {
                    if (!selected) return;
                    try {
                      setBusy(true);
                      const amount = numFromRaw(amountRaw);
                      const total = numFromRaw(totalRaw);
                      const fee = numFromRaw(feeRaw);

                      const payload: {
                        asset: { id: string; symbol: string; name: string };
                        side: "buy" | "sell";
                        priceMode: "market" | "custom";
                        priceUsd?: number;
                        qty?: number;
                        totalUsd?: number;
                        feeUsd: number;
                        chainId?: string;
                        isStablecoin?: boolean;
                        executedAt: string;
                      } = {
                        asset: {
                          id: selected.id,
                          symbol: selected.symbol,
                          name: selected.name,
                        },
                        side,
                        priceMode: "custom",
                        priceUsd,
                        qty:
                          lastEdited.current === "total"
                            ? undefined
                            : amount || undefined,
                        totalUsd:
                          lastEdited.current === "amount"
                            ? undefined
                            : total || undefined,
                        feeUsd: fee,
                        chainId: selectedChainId || undefined,
                        isStablecoin:
                          mode === "add" && side === "buy"
                            ? isStablecoin
                            : undefined,
                        executedAt: new Date().toISOString(),
                      };

                      const url =
                        mode === "edit" && props.initialTx?.id
                          ? `/api/portfolio/transaction/${props.initialTx.id}`
                          : "/api/portfolio/add-transaction";

                      const method = mode === "edit" ? "PUT" : "POST";

                      const res = await fetch(url, {
                        method,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(
                          mode === "edit"
                            ? {
                                side,
                                qty: amount,
                                priceUsd: priceUsd,
                                feeUsd: fee,
                                chainId: selectedChainId || undefined,
                                executedAt: props.initialTx?.executedAt,
                              }
                            : payload,
                        ),
                      });

                      if (!res.ok) {
                        const j = (await res.json().catch(() => null)) as {
                          error?: unknown;
                        } | null;
                        const msg =
                          typeof j?.error === "string"
                            ? j.error
                            : "Failed to save changes";
                        throw new Error(msg);
                      }

                      await props.onDone();
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Failed";
                      alert(msg);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  type="button"
                >
                  {mode === "edit" ? "Save changes" : "Save"}
                </button>
              )}
            </div>
          </div>
        }
      >
        {step === "pick" && mode !== "edit" ? (
          <div className="grid gap-4">
            <label className="grid gap-1">
              <span className="text-xs text-gray-500">Search asset</span>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                placeholder="Search BTC, ETH, Solana..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            {!hasQuery && (
              <div className="grid gap-2">
                <div className="text-xs font-semibold text-gray-600">
                  Top by market cap
                </div>
                <div className="grid gap-2 sm:grid-cols-2 max-h-80 overflow-y-auto">
                  {top.map((a) => (
                    <button
                      key={a.id}
                      className="cursor-pointer rounded-xl border border-gray-200 p-3 text-left hover:bg-gray-50"
                      onClick={async () => {
                        setSelected(a);
                        setSelectedChainId("");
                        setStep("form");
                        setSide("buy");
                        setPriceRaw("");
                        setAmountRaw("");
                        setTotalRaw("");
                        setFeeRaw("0");
                        setIsStablecoin(false);
                        lastEdited.current = null;
                        await loadMarketPrice(a.id);
                      }}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="grid">
                          <span className="font-semibold">{a.symbol}</span>
                          <span className="text-xs text-gray-500">
                            {a.name}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700">
                          {a.priceUsd != null ? usd(a.priceUsd) : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results.length > 0 && (
              <div className="grid gap-2">
                <div className="text-xs font-semibold text-gray-600">
                  Search results
                </div>
                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {results.map((a) => (
                    <button
                      key={a.id}
                      className="cursor-pointer rounded-xl border border-gray-200 p-3 text-left hover:bg-gray-50"
                      onClick={async () => {
                        setSelected(a);
                        setSelectedChainId("");
                        setStep("form");
                        setSide("buy");
                        setPriceRaw("");
                        setAmountRaw("");
                        setTotalRaw("");
                        setFeeRaw("0");
                        setIsStablecoin(false);
                        lastEdited.current = null;
                        await loadMarketPrice(a.id);
                      }}
                      type="button"
                    >
                      <div className="grid">
                        <span className="font-semibold">{a.symbol}</span>
                        <span className="text-xs text-gray-500">{a.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={cls(
                  "cursor-pointer px-3 py-2 rounded-xl text-sm border",
                  side === "buy"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white border-gray-200",
                )}
                onClick={() => setSide("buy")}
                type="button"
              >
                Buy
              </button>
              <button
                className={cls(
                  "cursor-pointer px-3 py-2 rounded-xl text-sm border",
                  side === "sell"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white border-gray-200",
                )}
                onClick={() => setSide("sell")}
                type="button"
              >
                Sell
              </button>
            </div>

            <label className="grid gap-1">
              <span className="text-xs text-gray-500">Chain</span>
              <span className="relative block">
                <select
                  className="w-full cursor-pointer appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-12"
                  value={selectedChainId}
                  onChange={(event) => setSelectedChainId(event.target.value)}
                >
                  {(chainOptions.length
                    ? chainOptions
                    : [
                        {
                          id: selectedChainId || "other",
                          name: "Other Chain",
                          symbol: "OTHER",
                        },
                      ]
                  ).map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              </span>
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-gray-500">
                Price (USD) <span className="text-red-600">*</span>
              </span>
              <MoneyInputStandalone
                valueRaw={priceRaw}
                onChangeRaw={(v) => setPriceRaw(v)}
                maxDecimals={8}
                placeholder="0"
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs text-gray-500">Amount</span>
                <MoneyInputStandalone
                  valueRaw={amountRaw}
                  onChangeRaw={(v) => {
                    lastEdited.current = "amount";
                    lastChanged.current = "amount";
                    setAmountRaw(v);
                    const n = numFromRaw(v);
                    if (!n || priceUsd <= 0) setTotalRaw("");
                    else setTotalRaw(String(totalFromAmount(n, priceUsd)));
                  }}
                  placeholder="0"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-gray-500">Total (USD)</span>
                <MoneyInputStandalone
                  valueRaw={totalRaw}
                  onChangeRaw={(v) => {
                    lastEdited.current = "total";
                    lastChanged.current = "total";
                    setTotalRaw(v);
                    const n = numFromRaw(v);
                    if (!n || priceUsd <= 0) setAmountRaw("");
                    else setAmountRaw(String(amountFromTotal(n, priceUsd)));
                  }}
                  placeholder="0"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                />
              </label>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="mb-3 text-sm font-semibold text-gray-700">
                Fees
              </div>
              <label className="grid gap-1">
                <span className="text-xs text-gray-500">
                  Trading Fee (USD) <span className="text-red-600">*</span>
                </span>
                <MoneyInputStandalone
                  valueRaw={feeRaw}
                  onChangeRaw={(v) => {
                    lastChanged.current = "fee";
                    setFeeRaw(v);
                  }}
                  maxDecimals={8}
                  placeholder="0"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2"
                />
              </label>
            </div>

            {mode === "add" && side === "buy" ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300"
                  checked={isStablecoin}
                  onChange={(e) => setIsStablecoin(e.target.checked)}
                />
                <span className="grid gap-0.5">
                  <span className="font-semibold text-slate-800">
                    Is Stablecoin
                  </span>
                  <span className="text-xs text-slate-500">
                    This asset is considered a cash-like holding and won&apos;t
                    appear in investment performance metrics.
                  </span>
                </span>
              </label>
            ) : null}

            <div className="text-xs text-gray-500">
              Price is pre-filled with the current market price and can be
              edited. Amount and Total are calculated from each other.
            </div>

            {!hasLockedInitialAsset && (
              <button
                className="cursor-pointer text-xs text-slate-500 underline justify-self-start"
                onClick={async () => {
                  setStep("pick");
                  setSelected(null);
                  setChainOptions([]);
                  setSelectedChainId("");
                  setAmountRaw("");
                  setTotalRaw("");
                  setFeeRaw("0");
                  setIsStablecoin(false);
                  setPriceRaw("");
                  lastEdited.current = null;
                  lastChanged.current = null;
                }}
                type="button"
              >
                Back to asset selection
              </button>
            )}
          </div>
        )}
      </Modal>

      {confirmDeleteOpen && (
        <Modal
          open
          onClose={() => (busy ? null : setConfirmDeleteOpen(false))}
          title="Delete Transaction"
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                className="cursor-pointer rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setConfirmDeleteOpen(false)}
                type="button"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="cursor-pointer rounded-xl bg-red-600 text-white px-4 py-2 text-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void handleDeleteNow()}
                type="button"
                disabled={busy}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          }
        >
          <div className="text-sm text-gray-700">
            Are you sure you want to delete this transaction
            {selected?.symbol ? (
              <>
                {" "}
                for <b>{selected.symbol}</b>
              </>
            ) : null}
            ?
            <div className="mt-2 text-xs text-gray-500">
              This action cannot be undone.
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
