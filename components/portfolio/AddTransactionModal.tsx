"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { MoneyInputStandalone } from "@/components/form/MaskedFields";
import { cls, usd } from "@/components/portfolio/format";
import type { TxRow } from "@/components/portfolio/TransactionsTable";

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
  color?: string;
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

const CONVERT_PROCEEDS_ENABLED_KEY = "stakk.sellConvert.enabled";
const CONVERT_PROCEEDS_ASSET_KEY = "stakk.sellConvert.asset";
const STABLECOIN_SYMBOLS = new Set(["USDT", "USDC", "DAI", "TUSD", "USDP"]);
const DEFAULT_RECEIVE_ASSET: AssetPick = {
  id: "tether",
  symbol: "USDT",
  name: "Tether",
};
const COMMON_RECEIVE_ASSETS: AssetPick[] = [
  DEFAULT_RECEIVE_ASSET,
  { id: "usd-coin", symbol: "USDC", name: "USDC" },
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "hyperliquid", symbol: "HYPE", name: "Hyperliquid" },
];

export default function AddTransactionModal(props: {
  open: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
  mode?: "add" | "edit";
  initialTx?: TxRow | null;
  initialAsset?: AssetPick | null;
  stablecoinSymbols?: string[];
}) {
  const mode = props.mode ?? "add";
  const [step, setStep] = useState<Step>("pick");
  const [top, setTop] = useState<AssetPick[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetPick[]>([]);
  const [selected, setSelected] = useState<AssetPick | null>(null);
  const [chainOptions, setChainOptions] = useState<ChainOption[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string>("");
  const [chainQuery, setChainQuery] = useState("");
  const [chainsLoading, setChainsLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [topLoading, setTopLoading] = useState(false);

  const [side, setSide] = useState<"buy" | "sell">("buy");

  const [priceRaw, setPriceRaw] = useState<string>("");

  const [amountRaw, setAmountRaw] = useState<string>("");
  const [totalRaw, setTotalRaw] = useState<string>("");
  const [feeRaw, setFeeRaw] = useState<string>("0");
  const [isStablecoin, setIsStablecoin] = useState(false);
  const [convertProceeds, setConvertProceeds] = useState(false);
  const [receiveAsset, setReceiveAsset] = useState<AssetPick>(
    DEFAULT_RECEIVE_ASSET,
  );
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
    setChainQuery("");
    setChainsLoading(false);
    setPriceLoading(false);
    setTopLoading(false);

    setSide("buy");
    setPriceRaw("");

    setAmountRaw("");
    setTotalRaw("");
    setFeeRaw("0");
    setIsStablecoin(false);
    setConvertProceeds(false);
    setReceiveAsset(DEFAULT_RECEIVE_ASSET);
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
    if (typeof window === "undefined") return;

    setConvertProceeds(
      window.localStorage.getItem(CONVERT_PROCEEDS_ENABLED_KEY) === "true",
    );

    const storedAsset = window.localStorage.getItem(CONVERT_PROCEEDS_ASSET_KEY);
    if (!storedAsset) return;

    try {
      const parsed = JSON.parse(storedAsset) as Partial<AssetPick>;
      if (parsed.id && parsed.symbol && parsed.name) {
        setReceiveAsset({
          id: String(parsed.id),
          symbol: String(parsed.symbol).toUpperCase(),
          name: String(parsed.name),
          thumb: parsed.thumb ?? null,
        });
      }
    } catch {
      setReceiveAsset(DEFAULT_RECEIVE_ASSET);
    }
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
    setChainQuery("");
  }, [props.open, mode, props.initialTx]);

  const loadMarketPrice = useCallback(async (id: string) => {
    setConfirmDeleteOpen(false);

    setPriceLoading(true);
    try {
      const res = await fetch(
        `/api/portfolio/assets/price?id=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const j = (await res.json()) as PriceResponse;
      const p = Number(j.priceUsd ?? 0);
      setPriceRaw(p > 0 ? String(p) : "");
    } finally {
      setPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!props.open) return;
    if (mode !== "add") return;
    if (!props.initialAsset) return;

    const asset = props.initialAsset;
    setSelected(asset);
    setSelectedChainId("");
    setChainQuery("");
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
    setChainsLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({
          id: selected.id,
          symbol: selected.symbol,
        });
        if (chainQuery.trim()) {
          params.set("q", chainQuery.trim());
        }
        const res = await fetch(
          `/api/portfolio/assets/chains?${params.toString()}`,
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
          if (current) {
            return current;
          }
          return json?.defaultChainId ?? options[0]?.id ?? "other";
        });
      } finally {
        if (!cancelled) setChainsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chainQuery, props.open, selected]);

  useEffect(() => {
    if (!props.open) return;
    (async () => {
      setTopLoading(true);
      try {
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
      } finally {
        setTopLoading(false);
      }
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
  const selectedSymbol = selected?.symbol.trim().toUpperCase() ?? "";
  const configuredStablecoins = useMemo(
    () =>
      new Set(
        (props.stablecoinSymbols ?? [])
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean),
      ),
    [props.stablecoinSymbols],
  );
  const isSelectedStablecoin =
    isStablecoin ||
    (!!selectedSymbol &&
      (STABLECOIN_SYMBOLS.has(selectedSymbol) ||
        configuredStablecoins.has(selectedSymbol)));
  const canConvertSellProceeds =
    mode === "add" && side === "sell" && !!selected && !isSelectedStablecoin;
  const receiveOptions = useMemo(() => {
    const rows = [receiveAsset, ...COMMON_RECEIVE_ASSETS, ...top]
      .filter((asset) => asset.symbol.trim().toUpperCase() !== selectedSymbol)
      .filter(
        (asset, index, list) =>
          list.findIndex(
            (item) =>
              item.symbol.trim().toUpperCase() ===
              asset.symbol.trim().toUpperCase(),
          ) === index,
      );

    return rows.length ? rows : [DEFAULT_RECEIVE_ASSET];
  }, [receiveAsset, selectedSymbol, top]);
  const effectiveReceiveAsset =
    receiveOptions.find((asset) => asset.symbol === receiveAsset.symbol) ??
    receiveOptions[0] ??
    DEFAULT_RECEIVE_ASSET;
  const netSellProceedsUsd = Math.max(
    numFromRaw(totalRaw) - numFromRaw(feeRaw),
    0,
  );
  const effectiveReceivePriceUsd =
    effectiveReceiveAsset.priceUsd && effectiveReceiveAsset.priceUsd > 0
      ? effectiveReceiveAsset.priceUsd
      : STABLECOIN_SYMBOLS.has(effectiveReceiveAsset.symbol)
        ? 1
        : 0;
  const estimatedReceiveQty =
    effectiveReceivePriceUsd > 0
      ? netSellProceedsUsd / effectiveReceivePriceUsd
      : netSellProceedsUsd;
  const formInfoLoading = chainsLoading || priceLoading || topLoading;

  function setConvertProceedsPreference(next: boolean) {
    setConvertProceeds(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CONVERT_PROCEEDS_ENABLED_KEY, String(next));
    }
  }

  function setReceiveAssetPreference(next: AssetPick) {
    setReceiveAsset(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        CONVERT_PROCEEDS_ASSET_KEY,
        JSON.stringify({
          id: next.id,
          symbol: next.symbol,
          name: next.name,
          thumb: next.thumb ?? null,
        }),
      );
    }
  }

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
                        convertProceeds?: {
                          enabled: boolean;
                          asset: { id: string; symbol: string; name: string };
                        };
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
                        convertProceeds:
                          canConvertSellProceeds && convertProceeds
                            ? {
                                enabled: true,
                                asset: {
                                  id: effectiveReceiveAsset.id,
                                  symbol: effectiveReceiveAsset.symbol,
                                  name: effectiveReceiveAsset.name,
                                },
                              }
                            : undefined,
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
                  {canConvertSellProceeds && convertProceeds
                    ? "Sell & Convert"
                    : mode === "edit"
                      ? "Save changes"
                      : "Save"}
                </button>
              )}
            </div>
          </div>
        }
      >
        {step === "pick" && mode !== "edit" ? (
          <div className="grid gap-4">
            {topLoading ? <LoadingBar label="Loading assets..." /> : null}
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
                        setChainQuery("");
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
            {formInfoLoading ? (
              <LoadingBar label="Loading asset data..." />
            ) : null}
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
              <ChainPicker
                options={chainOptions}
                query={chainQuery}
                selectedChainId={selectedChainId}
                onQueryChange={setChainQuery}
                onSelect={(chain) => {
                  setSelectedChainId(chain.id);
                  setChainQuery("");
                }}
              />
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

            {canConvertSellProceeds ? (
              <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300"
                    checked={convertProceeds}
                    onChange={(e) =>
                      setConvertProceedsPreference(e.target.checked)
                    }
                  />
                  <span className="font-semibold text-slate-800">
                    Convert proceeds to another asset
                  </span>
                </label>

                {convertProceeds ? (
                  <div className="grid gap-3 border-t border-gray-100 pt-3">
                    <label className="grid gap-1">
                      <span className="text-xs text-gray-500">Receive</span>
                      <select
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#CBB5FF]"
                        value={effectiveReceiveAsset.symbol}
                        onChange={(event) => {
                          const next =
                            receiveOptions.find(
                              (asset) => asset.symbol === event.target.value,
                            ) ?? DEFAULT_RECEIVE_ASSET;
                          setReceiveAssetPreference(next);
                        }}
                      >
                        {receiveOptions.map((asset) => (
                          <option key={asset.symbol} value={asset.symbol}>
                            {asset.symbol} - {asset.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-1 text-xs text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <span>You Sell</span>
                        <span className="font-semibold text-slate-800">
                          {numFromRaw(amountRaw).toLocaleString("en-US", {
                            maximumFractionDigits: 8,
                          })}{" "}
                          {selected.symbol}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Value</span>
                        <span className="font-semibold text-slate-800">
                          {usd(netSellProceedsUsd)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>You Receive</span>
                        <span className="font-semibold text-slate-800">
                          ≈{" "}
                          {estimatedReceiveQty.toLocaleString("en-US", {
                            maximumFractionDigits: 8,
                          })}{" "}
                          {effectiveReceiveAsset.symbol}
                        </span>
                      </div>
                      <div className="pt-2 font-semibold text-slate-700">
                        {selected.symbol} → {effectiveReceiveAsset.symbol}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
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
                  setChainQuery("");
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

function LoadingBar({ label }: { label: string }) {
  return (
    <div
      className="grid gap-2 rounded-xl border border-[#E6EAF2] bg-[#F8FAFC] px-3 py-2"
      aria-live="polite"
    >
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/2 animate-[pulse_1.1s_ease-in-out_infinite] rounded-full bg-[#7C3AED]" />
      </div>
    </div>
  );
}

function ChainPicker({
  options,
  query,
  selectedChainId,
  onQueryChange,
  onSelect,
}: {
  options: ChainOption[];
  query: string;
  selectedChainId: string;
  onQueryChange: (value: string) => void;
  onSelect: (chain: ChainOption) => void;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const inputId = useMemo(
    () => `chain-search-${Math.random().toString(36).slice(2)}`,
    [],
  );
  const fallback =
    selectedChainId && !options.some((chain) => chain.id === selectedChainId)
      ? {
          id: selectedChainId,
          name: selectedChainId,
          symbol: selectedChainId.slice(0, 5).toUpperCase(),
        }
      : null;
  const selected =
    options.find((chain) => chain.id === selectedChainId) ?? fallback;
  const visibleOptions =
    showOptions || query.trim()
      ? options.length
        ? options
        : selected
          ? [selected]
          : []
      : selected
        ? [selected]
        : [];

  return (
    <div className="relative grid gap-2">
      <div
        className={cls(
          "flex min-h-12 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2",
          showOptions && "border-[#CBB5FF]",
        )}
      >
        {selected ? (
          <span className="inline-flex min-w-0 max-w-[58%] items-center gap-2 rounded-full bg-[#F5F0FF] px-3 py-1.5 text-sm font-semibold text-[#5F35D5]">
            <span className="min-w-0 truncate">{selected.name}</span>
          </span>
        ) : null}
        <input
          id={inputId}
          aria-label="Chain"
          className="min-w-[130px] flex-1 border-0 bg-transparent text-sm outline-none"
          value={query}
          onChange={(event) => {
            setShowOptions(true);
            onQueryChange(event.target.value);
          }}
          onFocus={() => setShowOptions(true)}
          onClick={() => setShowOptions(true)}
          onBlur={() => {
            window.setTimeout(() => setShowOptions(false), 120);
          }}
          placeholder={selected ? "Search another chain" : "Search chains..."}
        />
      </div>
      {showOptions ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 grid max-h-[194px] gap-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-[0_14px_32px_rgba(15,23,42,0.12)]">
          {visibleOptions.map((chain) => {
            const active = chain.id === selectedChainId;

            return (
              <button
                key={chain.id}
                type="button"
                className={cls(
                  "flex min-h-[34px] cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 text-left text-sm",
                  active
                    ? "bg-[#F5F0FF] font-semibold text-[#5F35D5]"
                    : "text-slate-700 hover:bg-gray-50",
                )}
                onClick={() => {
                  onSelect(chain);
                  setShowOptions(false);
                }}
              >
                <span className="min-w-0 truncate">{chain.name}</span>
                <span className="shrink-0 text-xs font-semibold text-slate-400">
                  {chain.symbol}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
