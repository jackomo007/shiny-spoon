"use client";

import { useEffect, useMemo, useState } from "react";

type AssetItem = { symbol: string; name: string | null; exchange?: string };

type CoinsApiResponse = { items?: AssetItem[] };

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
  const items = rawItems.filter(isAssetItem);
  return { items };
}

export default function AssetAutocomplete({
  value,
  onChange,
  placeholder = "BTC",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState(value);
  const [items, setItems] = useState<AssetItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    const query = q.trim();

    if (!query) {
      setItems([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/assets/coins?q=${encodeURIComponent(query)}`,
          { cache: "no-store" }
        );

        const parsed = parseCoinsApiResponse(
          (await res.json().catch(() => null)) as unknown
        );

        const list = (parsed.items ?? [])
          .map((it) => ({
            ...it,
            symbol: toAssetSymbol(it.symbol),
          }))
          .filter((it) => isPureAssetSymbol(it.symbol));

        if (!cancelled) {
          setItems(list);
          setOpen(list.length > 0);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setOpen(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q]);

  const hasResults = useMemo(() => items.length > 0, [items]);

  function commitIfValid(raw: string) {
    const sym = toAssetSymbol(raw);
    if (isPureAssetSymbol(sym)) {
      onChange(sym);
      setQ(sym);
      return true;
    }
    return false;
  }

  return (
    <div className="relative">
      <input
        className="w-full rounded-xl border p-2"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hasResults && setOpen(true)}
        onBlur={() => {
          const ok = commitIfValid(q);
          if (!ok) setQ(value);
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const ok = commitIfValid(q);
            if (ok) setOpen(false);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setQ(value);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="asset-autocomplete-list"
      />

      {open && (hasResults || loading) && (
        <div
          id="asset-autocomplete-list"
          className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow"
          onMouseDown={(e) => e.preventDefault()}
        >
          {loading && (
            <div className="p-2 text-sm text-gray-500">Loading…</div>
          )}

          {!loading && !hasResults && (
            <div className="p-2 text-sm text-gray-500">No results</div>
          )}

          {!loading &&
            items.map((it) => (
              <button
                key={it.symbol}
                type="button"
                className="block w-full text-left px-3 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  const sym = toAssetSymbol(it.symbol);
                  onChange(sym);
                  setQ(sym);
                  setOpen(false);
                }}
              >
                <div className="font-medium">{it.symbol}</div>
                <div className="text-xs text-gray-500">
                  {it.name ?? "—"}
                  {it.exchange ? ` · ${it.exchange}` : ""}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
