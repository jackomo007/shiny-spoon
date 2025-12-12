"use client";

import { useEffect, useMemo, useState } from "react";

type AssetItem = { symbol: string; name: string | null; exchange: string };

export default function AssetAutocomplete({
  value,
  onChange,
  placeholder = "BTCUSDT",
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
    if (!q || q.trim().length < 2) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/assets/search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!cancelled) {
          setItems(json.items || []);
          setOpen(true);
        }
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

  const hasResults = useMemo(() => items.length > 0, [items]);

  return (
    <div className="relative">
      <input
        className="w-full rounded-xl border p-2"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hasResults && setOpen(true)}
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
          {loading && <div className="p-2 text-sm text-gray-500">Loading…</div>}
          {!loading && !hasResults && (
            <div className="p-2 text-sm text-gray-500">No results</div>
          )}
          {!loading &&
            items.map((it) => (
              <button
                key={it.symbol}
                className="block w-full text-left px-3 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  onChange(it.symbol);
                  setQ(it.symbol);
                  setOpen(false);
                }}
              >
                <div className="font-medium">{it.symbol}</div>
                <div className="text-xs text-gray-500">
                  {it.name ?? "—"} · {it.exchange}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
