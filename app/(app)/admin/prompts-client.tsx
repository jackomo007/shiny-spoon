"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";

type Item = {
  id: string;
  key: string;
  title: string;
  description?: string | null;
  content: string;
  updated_at: string;
};

type TabId = "trade" | "chart" | "other";

const TAB_DEFS: Array<{
  id: TabId;
  label: string;
  description: string;
  keys: string[];
}> = [
  {
    id: "trade",
    label: "Trade Analyzer",
    description: "Prompts used by Trade Analyzer (system + user template).",
    keys: ["trade_analyzer_system", "trade_analyzer_template"],
  },
  {
    id: "chart",
    label: "Chart Analyzer",
    description: "Prompts used by Chart Analyzer (system).",
    keys: ["chart_analysis_system"],
  },
  {
    id: "other",
    label: "Other",
    description: "Other prompts not mapped to a specific page yet.",
    keys: [],
  },
];

function prettyPromptLabel(item: Item) {
  switch (item.key) {
    case "trade_analyzer_system":
      return "System — Trade Analyzer";
    case "trade_analyzer_template":
      return "User Template — Trade Analyzer";
    case "chart_analysis_system":
      return "System — Chart Analyzer";
    default:
      return item.title || item.key;
  }
}

export default function AdminPromptsClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<string, string>>({});

  const [tab, setTab] = useState<TabId>("trade");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState<string>("");
  const [modalMessage, setModalMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch("/api/admin/prompts", { cache: "no-store" });
      const js = (await res.json()) as { items?: Item[] };

      const loaded = js.items ?? [];
      if (cancelled) return;

      setItems(loaded);

      const hasKey = (keys: string[]) => loaded.some((it) => keys.includes(it.key));
      const firstWithData =
        TAB_DEFS.find((t) => t.id !== "other" && hasKey(t.keys))?.id ?? "other";
      setTab(firstWithData);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const knownKeySet = useMemo(() => {
    const s = new Set<string>();
    for (const t of TAB_DEFS) for (const k of t.keys) s.add(k);
    return s;
  }, []);

  const itemsByTab = useMemo(() => {
    const by: Record<TabId, Item[]> = { trade: [], chart: [], other: [] };

    for (const it of items) {
      const mapped =
        TAB_DEFS.find((t) => t.id !== "other" && t.keys.includes(it.key))?.id ?? null;

      if (mapped) by[mapped].push(it);
      else by.other.push(it);
    }

    const sortByKeyOrder = (arr: Item[], keys: string[]) => {
      if (!keys.length) return arr.slice();
      const idx = (k: string) => {
        const i = keys.indexOf(k);
        return i === -1 ? 999 : i;
      };
      return arr.slice().sort((a, b) => idx(a.key) - idx(b.key));
    };

    by.trade = sortByKeyOrder(by.trade, TAB_DEFS.find((t) => t.id === "trade")!.keys);
    by.chart = sortByKeyOrder(by.chart, TAB_DEFS.find((t) => t.id === "chart")!.keys);

    by.other = by.other.slice().sort((a, b) => (a.key < b.key ? -1 : 1));

    return by;
  }, [items]);

  const tabCounts = useMemo(() => {
    return {
      trade: itemsByTab.trade.length,
      chart: itemsByTab.chart.length,
      other: itemsByTab.other.length,
    };
  }, [itemsByTab]);

  const visibleItems = itemsByTab[tab] ?? [];

  function setContent(key: string, content: string) {
    setDirty((d) => ({ ...d, [key]: content }));
    setItems((arr) => arr.map((it) => (it.key === key ? { ...it, content } : it)));
  }

  async function save() {
    if (Object.keys(dirty).length === 0) return;

    setSaving(true);
    try {
      const payload = {
        items: Object.entries(dirty).map(([key, content]) => ({ key, content })),
      };

      const res = await fetch("/api/admin/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      setDirty({});
      setModalTitle("Success");
      setModalMessage("Prompts saved successfully.");
      setModalOpen(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      setModalTitle("Error");
      setModalMessage(msg);
      setModalOpen(true);
    } finally {
      setSaving(false);
    }
  }

  const dirtyCount = Object.keys(dirty).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-base font-semibold">Prompt Groups</div>
            <div className="text-sm text-gray-600">
              Choose a section (page) and edit the prompts used by the AI.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {TAB_DEFS.map((t) => {
              const count =
                t.id === "trade"
                  ? tabCounts.trade
                  : t.id === "chart"
                  ? tabCounts.chart
                  : tabCounts.other;

              const active = tab === t.id;

              if (t.id === "other" && count === 0 && items.every((x) => knownKeySet.has(x.key))) {
                return null;
              }

              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                    active ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50",
                  ].join(" ")}
                  type="button"
                >
                  <span>{t.label}</span>
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs",
                      active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4">
          <div className="text-sm text-gray-700">
            {TAB_DEFS.find((t) => t.id === tab)?.description}
          </div>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
          No prompts in this tab.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleItems.map((it) => {
            const isDirty = Object.prototype.hasOwnProperty.call(dirty, it.key);

            return (
              <div key={it.id} className="rounded-2xl border bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold">{prettyPromptLabel(it)}</div>
                      <span className="text-xs text-gray-500">({it.key})</span>
                      {isDirty && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          Unsaved
                        </span>
                      )}
                    </div>
                    {it.description ? (
                      <div className="text-xs text-gray-500">{it.description}</div>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-xs text-gray-500">
                    Updated: {new Date(it.updated_at).toLocaleString()}
                  </div>
                </div>

                <textarea
                  className="mt-3 w-full min-h-[220px] rounded-xl border p-3 font-mono text-sm leading-5"
                  value={it.content}
                  onChange={(e) => setContent(it.key, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          {dirtyCount === 0 ? "No changes." : `${dirtyCount} change(s) not saved.`}
        </div>

        <button
          onClick={save}
          disabled={saving || dirtyCount === 0}
          className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50 cursor-pointer"
          type="button"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        footer={
          <div className="flex justify-end">
            <button
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer"
              onClick={() => setModalOpen(false)}
              type="button"
            >
              OK
            </button>
          </div>
        }
      >
        <div className="whitespace-pre-wrap text-sm text-gray-700">{modalMessage}</div>
      </Modal>
    </div>
  );
}
