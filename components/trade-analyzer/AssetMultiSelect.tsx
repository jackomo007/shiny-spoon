"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AssetItem = { symbol: string; name: string | null; exchange?: string };
type CoinsApiResponse = { items?: AssetItem[] };

export type CoinSelection = string[] | "all";

const STABLE_SUFFIXES = ["USDT", "USDC", "BUSD", "TUSD", "DAI", "USD"] as const;

function isPureAssetSymbol(symbolRaw: string) {
  const s = (symbolRaw ?? "").trim().toUpperCase();
  if (!s) return false;
  if (s.includes("/") || s.includes("-") || s.includes("_") || s.includes(" "))
    return false;
  for (const suf of STABLE_SUFFIXES) {
    if (s.length > suf.length && s.endsWith(suf)) return false;
  }
  return /^[A-Z0-9]{2,15}$/.test(s);
}

function toAssetSymbol(raw: string) {
  return (raw ?? "").trim().toUpperCase();
}

function isObjectRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function isAssetItem(x: unknown): x is AssetItem {
  if (!isObjectRecord(x)) return false;
  return (
    typeof x.symbol === "string" &&
    ("name" in x ? x.name === null || typeof x.name === "string" : true) &&
    ("exchange" in x
      ? x.exchange === undefined || typeof x.exchange === "string"
      : true)
  );
}

function parseCoinsApiResponse(x: unknown): CoinsApiResponse {
  if (!isObjectRecord(x)) return {};
  const rawItems = x.items;
  if (!Array.isArray(rawItems)) return {};
  return { items: rawItems.filter(isAssetItem) };
}

export default function AssetMultiSelect({
  value,
  onChange,
  placeholder = "Search coins…",
}: {
  value: CoinSelection;
  onChange: (v: CoinSelection) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<AssetItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAll = value === "all";
  const selected = useMemo<string[]>(() => (value === "all" ? [] : value), [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQ("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setItems([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/assets/coins?q=${encodeURIComponent(query)}`,
          {
            cache: "no-store",
          },
        );
        const parsed = parseCoinsApiResponse(
          (await res.json().catch(() => null)) as unknown,
        );
        const list = (parsed.items ?? [])
          .map((it) => ({ ...it, symbol: toAssetSymbol(it.symbol) }))
          .filter((it) => isPureAssetSymbol(it.symbol));

        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q]);

  const filteredItems = useMemo(
    () => items.filter((it) => !selected.includes(it.symbol)),
    [items, selected],
  );

  function toggleCoin(symbol: string) {
    if (isAll) return;
    if (selected.includes(symbol)) {
      onChange(selected.filter((s) => s !== symbol));
    } else {
      onChange([...selected, symbol]);
    }
    setQ("");
    inputRef.current?.focus();
  }

  function removeCoin(symbol: string) {
    if (isAll) return;
    onChange(selected.filter((s) => s !== symbol));
  }

  function toggleAll() {
    if (isAll) {
      onChange([]);
    } else {
      onChange("all");
    }
    setQ("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !q && selected.length > 0) {
      removeCoin(selected[selected.length - 1]!);
    }
    if (e.key === "Escape") {
      setOpen(false);
      setQ("");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="min-h-[42px] w-full rounded-xl border border-gray-200 bg-white px-2 py-1.5 flex flex-wrap gap-1.5 items-center cursor-text focus-within:ring-2 focus-within:ring-purple-400 focus-within:border-purple-400 transition-all"
        onClick={() => {
          if (!isAll) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        {isAll && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-purple-100 text-purple-700 text-sm px-2 py-0.5 font-medium">
            All Coins
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleAll();
              }}
              className="hover:text-purple-900 leading-none"
              aria-label="Remove All Coins"
            >
              ×
            </button>
          </span>
        )}

        {!isAll &&
          selected.map((sym) => (
            <span
              key={sym}
              className="inline-flex items-center gap-1 rounded-lg bg-purple-100 text-purple-700 text-sm px-2 py-0.5 font-medium"
            >
              {sym}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCoin(sym);
                }}
                className="hover:text-purple-900 leading-none"
                aria-label={`Remove ${sym}`}
              >
                ×
              </button>
            </span>
          ))}

        {!isAll && (
          <input
            ref={inputRef}
            className="flex-1 min-w-[100px] outline-none bg-transparent text-sm placeholder-gray-400 py-0.5"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selected.length === 0 ? placeholder : ""}
          />
        )}

        <button
          type="button"
          className="ml-auto text-gray-400 hover:text-gray-600 px-1"
          onClick={(e) => {
            e.stopPropagation();
            if (!isAll) setOpen((o) => !o);
          }}
          tabIndex={-1}
        >
          <svg
            className={`w-4 h-4 transition-transform ${open && !isAll ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {open && !isAll && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            <button
              type="button"
              className="flex items-center gap-3 w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b"
              onClick={toggleAll}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" />
              <div>
                <div className="font-medium text-sm">All Coins</div>
                <div className="text-xs text-gray-500">
                  Apply strategy to all assets
                </div>
              </div>
            </button>

            {loading && (
              <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>
            )}

            {!loading && q.trim() && filteredItems.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">No results</div>
            )}

            {filteredItems.map((it) => {
              const isChecked = selected.includes(it.symbol);
              return (
                <button
                  key={it.symbol}
                  type="button"
                  className={`flex items-center gap-3 w-full text-left px-3 py-2.5 hover:bg-gray-50 ${isChecked ? "bg-purple-50" : ""}`}
                  onClick={() => toggleCoin(it.symbol)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isChecked
                        ? "bg-purple-600 border-purple-600"
                        : "border-gray-300"
                    }`}
                  >
                    {isChecked && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{it.symbol}</div>
                    <div className="text-xs text-gray-500">
                      {it.name ?? "—"}
                      {it.exchange ? ` · ${it.exchange}` : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
