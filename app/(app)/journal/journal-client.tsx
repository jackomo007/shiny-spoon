"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { Table, Th, Tr, Td } from "@/components/ui/Table";

type TradeType = 1 | 2;

type JournalRow = {
  id: string;
  asset_name: string;
  trade_type: TradeType;
  side: "buy" | "sell" | "long" | "short";
  status: "in_progress" | "win" | "loss" | "break_even";
  entry_price: number;
  exit_price: number | null;
  amount: number;
  date: string | Date;
  strategy_id: string;
  pnl?: number | null;
};

type StrategyOption = { id: string; name: string | null };

type JournalForm = {
  strategy_id: string;
  asset_name: string;
  trade_type: TradeType | string;
  date: string;
  time: string;
  side: "buy" | "sell" | "long" | "short";
  status: "in_progress" | "win" | "loss" | "break_even";
  amount: string;
  entry_price: string;
  exit_price?: string;
  strategy_rule_match: string;
  notes_entry?: string;
  notes_review?: string;
  // futures only
  leverage?: string;
  liquidation_price?: string;
  margin_used?: string;
};

function composeDateTime(date: string, time: string | undefined): string {
  const d = date || new Date().toISOString().slice(0, 10);
  const t = time && time.length >= 4 ? time : "00:00";
  return new Date(`${d}T${t}:00`).toISOString();
}

export default function JournalClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<JournalRow[]>([]);
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);

  // toolbar
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "az" | "za">("new");
  const [showFilter, setShowFilter] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // modal create/edit
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  // modal delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // form
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<JournalForm>({
    defaultValues: {
      strategy_id: "",
      asset_name: "",
      trade_type: 1,
      date: "",
      time: "",
      side: "buy",
      status: "in_progress",
      amount: "",
      entry_price: "",
      exit_price: "",
      strategy_rule_match: "0",
      notes_entry: "",
      notes_review: "",
      leverage: "",
      liquidation_price: "",
      margin_used: "",
    },
  });

  const wTradeType = Number(watch("trade_type") ?? 1) as TradeType;
  const wAmount = watch("amount");
  const wEntry = watch("entry_price");
  const wLev = watch("leverage");
  type StrategiesApiShape =
  | StrategyOption[]
  | { items: StrategyOption[]; summary?: unknown };

  useEffect(() => {
    if (wTradeType === 2) {
      const a = parseFloat(wAmount || "0");
      const ep = parseFloat(wEntry || "0");
      const lev = parseInt((wLev || "1").replace(/[^\d]/g, ""), 10) || 1;
      const margin = a > 0 && ep > 0 ? (a * ep) / Math.max(1, lev) : 0;
      setValue("margin_used", margin ? String(margin) : "");
    } else {
      setValue("margin_used", "");
      setValue("leverage", "");
      setValue("liquidation_price", "");
    }
  }, [wTradeType, wAmount, wEntry, wLev, setValue]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [jr, st] = await Promise.all([
        fetch("/api/journal", { cache: "no-store" }),
        fetch("/api/strategies", { cache: "no-store" }),
      ]);

      if (!jr.ok) throw new Error(await jr.text());
      if (!st.ok) throw new Error(await st.text());

      // journal rows
      const journalPayload: unknown = await jr.json();
      // se o endpoint /api/journal retornar um array de JournalRow
      if (Array.isArray(journalPayload)) {
        setItems(journalPayload as JournalRow[]);
      } else if (
        typeof journalPayload === "object" &&
        journalPayload !== null &&
        "items" in journalPayload &&
        Array.isArray((journalPayload as { items: unknown }).items)
      ) {
        setItems((journalPayload as { items: JournalRow[] }).items);
      } else {
        setItems([]);
      }

      // strategies
    const strategiesPayload: StrategiesApiShape = await st.json();

    let list: StrategyOption[] = [];
    if (Array.isArray(strategiesPayload)) {
      list = strategiesPayload;
    } else {
      list = strategiesPayload.items;
    }

    setStrategies(list.map(({ id, name }) => ({ id, name })));

    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load journal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // filtro + sort
  const rows = useMemo(() => {
    let arr = items;
    const q = query.trim().toLowerCase();
    if (q)
      arr = arr.filter((i) =>
        `${i.asset_name} ${i.status} ${i.side}`.toLowerCase().includes(q)
      );
    switch (sort) {
      case "az":
        return [...arr].sort((a, b) =>
          a.asset_name.localeCompare(b.asset_name)
        );
      case "za":
        return [...arr].sort((a, b) =>
          b.asset_name.localeCompare(a.asset_name)
        );
      default:
        return [...arr].sort((a, b) => +new Date(b.date) - +new Date(a.date));
    }
  }, [items, query, sort]);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    reset({
      strategy_id: "",
      asset_name: "",
      trade_type: 1,
      date: "",
      time: "",
      side: "buy",
      status: "in_progress",
      amount: "",
      entry_price: "",
      exit_price: "",
      strategy_rule_match: "0",
      notes_entry: "",
      notes_review: "",
      leverage: "",
      liquidation_price: "",
      margin_used: "",
    });
    setOpen(true);
  }

  function openEdit(row: JournalRow) {
    setMode("edit");
    setEditingId(row.id);
    const dt = new Date(row.date);
    reset({
      strategy_id: row.strategy_id,
      asset_name: row.asset_name,
      trade_type: row.trade_type,
      date: dt.toISOString().slice(0, 10),
      time: dt.toISOString().slice(11, 16),
      side: row.side,
      status: row.status,
      amount: String(row.amount ?? ""),
      entry_price: String(row.entry_price ?? ""),
      exit_price: row.exit_price != null ? String(row.exit_price) : "",
      strategy_rule_match: "0",
      notes_entry: "",
      notes_review: "",
      leverage: "",
      liquidation_price: "",
      margin_used: "",
    });
    setOpen(true);
  }

  async function onSubmit(form: JournalForm) {
    const tradeType = Number(form.trade_type) as TradeType;
    const payload = {
      asset_name: form.asset_name,
      trade_type: tradeType, // 1|2
      trade_datetime: composeDateTime(form.date, form.time),
      side: form.side,
      status: form.status,
      amount: Number(form.amount),
      strategy_id: form.strategy_id,
      notes_entry: form.notes_entry?.trim() || null,
      notes_review: form.notes_review?.trim() || null,
      strategy_rule_match: Number(form.strategy_rule_match || "0"),
      entry_price: Number(form.entry_price),
      exit_price: form.exit_price ? Number(form.exit_price) : null,
      ...(tradeType === 2
        ? {
            futures: {
              leverage: parseInt(
                (form.leverage || "").replace(/[^\d]/g, ""),
                10
              ),
              margin_used: Number(form.margin_used || 0),
              liquidation_price: Number(form.liquidation_price || 0),
            },
          }
        : {}),
    };

    try {
      const url =
        mode === "create" ? "/api/journal" : `/api/journal/${editingId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      setOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save");
    }
  }

  function askDelete(id: string) {
    setDeleteId(id);
    setConfirmOpen(true);
  }
  async function confirmDelete() {
    if (!deleteId) return;
    try {
      setDeleting(true);
      const r = await fetch(`/api/journal/${deleteId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      setConfirmOpen(false);
      setDeleteId(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-end gap-3">
        <button className="flex items-center gap-2 rounded-xl bg-white text-gray-700 px-3 py-2 shadow-sm hover:bg-gray-50">
          📄 Export
        </button>
        <button className="flex items-center gap-2 rounded-xl bg-white text-gray-700 px-3 py-2 shadow-sm hover:bg-gray-50">
          ⚙️ Settings
        </button>
        <button
          onClick={openCreate}
          className="h-10 w-10 rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-50"
        >
          ＋
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <div className="flex justify-between">
            <div className="flex flex-col">
              <div className="text-sm text-gray-600">Total Trades</div>
              <div className="mt-2 text-2xl font-semibold">{items.length}</div>
            </div>
            <div className="right-0 top-0 h-10 w-10 grid place-items-center rounded-full bg-yellow-400 text-white">
              👥
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex justify-between">
            <div className="flex flex-col">
              <div className="text-sm text-gray-600">Win Rate</div>
              <div className="mt-2 text-2xl font-semibold">
                {(() => {
                  const wins = items.filter((i) => i.status === "win").length;
                  return items.length
                    ? `${Math.round((wins / items.length) * 100)}%`
                    : "0%";
                })()}
              </div>
            </div>
            <div className="right-0 top-0  h-10 w-10 grid place-items-center rounded-full bg-purple-500 text-white">
              👁️
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex justify-between">
            <div className="flex flex-col">
              <div className="text-sm text-gray-600">Earnings</div>
              <div className="mt-2 text-2xl font-semibold">
                {(() => {
                  const total = items.reduce(
                    (acc, i) => acc + (i.amount || 0),
                    0
                  );
                  return total ? `$${total.toLocaleString()}` : "$0";
                })()}
              </div>
            </div>
            <div className="right-6 top-6 h-10 w-10 grid place-items-center rounded-full bg-orange-500 text-white">
              $
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        {showSearch && (
          <div className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <span className="text-gray-400">🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type and hit enter ..."
                className="flex-1 outline-none bg-transparent text-gray-700 placeholder:text-gray-400"
              />
              <button
                onClick={() => setShowSearch(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✖
              </button>
            </div>
          </div>
        )}

        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Trades</h3>
          <div className="flex items-center gap-3 relative">
            <button
              onClick={() => setShowSearch((s) => !s)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              🔍
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  setShowFilter((f) => !f);
                  setShowMenu(false);
                }}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                🧰
              </button>
              {showFilter && (
                <div
                  className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-20"
                  onMouseLeave={() => setShowFilter(false)}
                >
                  <MenuItem
                    label="Newest"
                    onClick={() => {
                      setSort("new");
                      setShowFilter(false);
                    }}
                    icon="🧾"
                  />
                  <MenuItem
                    label="From A-Z"
                    onClick={() => {
                      setSort("az");
                      setShowFilter(false);
                    }}
                    icon="🔤"
                  />
                  <MenuItem
                    label="From Z-A"
                    onClick={() => {
                      setSort("za");
                      setShowFilter(false);
                    }}
                    icon="🔠"
                  />
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowMenu((m) => !m);
                  setShowFilter(false);
                }}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                ⋯
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-20"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  <MenuItem
                    label="Refresh"
                    onClick={() => {
                      void load();
                      setShowMenu(false);
                    }}
                  />
                  <MenuItem
                    label="Manage Widgets"
                    onClick={() => setShowMenu(false)}
                  />
                  <MenuItem
                    label="Settings"
                    onClick={() => setShowMenu(false)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-2">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading…
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-red-600">
              {error}
            </div>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Asset</Th>
                    <Th>Type</Th>
                    <Th>Side</Th>
                    <Th>Entry Price</Th>
                    <Th>Exit Price</Th>
                    <Th>PnL</Th>
                    <Th>Amount</Th>
                    <Th>Date</Th>
                    <Th>Status</Th>
                    <Th> </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0 ? (
                    rows.map((r) => (
                      <Tr key={r.id}>
                        <Td>{r.asset_name}</Td>
                        <Td>{r.trade_type === 2 ? "Futures" : "Spot"}</Td>
                        <Td>{r.side}</Td>
                        <Td>${Number(r.entry_price).toFixed(2)}</Td>
                        <Td>
                          {r.exit_price != null
                            ? `$${Number(r.exit_price).toFixed(2)}`
                            : "—"}
                        </Td>
                        <Td>
                          {r.pnl != null ? `$${Number(r.pnl).toFixed(2)}` : "—"}
                        </Td>
                        <Td>{Number(r.amount).toFixed(4)}</Td>
                        <Td>{new Date(r.date).toLocaleString()}</Td>
                        <Td>{r.status.replace("_", " ")}</Td>
                        <Td>
                          <div className="flex gap-3 justify-end">
                            <button
                              title="Edit"
                              onClick={() => openEdit(r)}
                              className="text-gray-600 hover:text-gray-800"
                            >
                              ✏️
                            </button>
                            <button
                              title="Delete"
                              onClick={() => askDelete(r.id)}
                              className="text-orange-600 hover:text-orange-700"
                            >
                              🗑️
                            </button>
                          </div>
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={10}
                        className="py-12 text-center text-sm text-gray-500"
                      >
                        No rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </>
          )}
        </div>
      </Card>

      {/* Modal Create/Edit */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "Add Trade" : "Edit Trade"}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {mode === "create" ? "Add Trade" : "Save Changes"}
            </button>
          </div>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
            {/* Strategy */}
            <div>
              <div className="text-sm mb-1">
                Strategy Used <span className="text-red-600">*</span>
              </div>
              <select
                {...register("strategy_id", { required: true })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select a strategy…</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || "Untitled"}
                  </option>
                ))}
              </select>
            </div>

            {/* Asset Name */}
            <div>
              <div className="text-sm mb-1">
                Asset Name <span className="text-red-600">*</span>
              </div>
              <input
                {...register("asset_name", { required: true })}
                placeholder="e.g. BTC/USDT"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Trade Type */}
            <div>
              <div className="text-sm mb-1">
                Trade Type <span className="text-red-600">*</span>
              </div>
              <select
                {...register("trade_type", { required: true })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value={1}>Spot</option>
                <option value={2}>Futures</option>
              </select>
            </div>

            {/* Date / Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm mb-1">Date</div>
                <input
                  type="date"
                  {...register("date")}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <div className="text-sm mb-1">Time</div>
                <input
                  type="time"
                  {...register("time")}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Side / Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm mb-1">Side</div>
                <select
                  {...register("side", { required: true })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
              <div>
                <div className="text-sm mb-1">Status</div>
                <select
                  {...register("status", { required: true })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="in_progress">In Progress</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="break_even">Break-Even</option>
                </select>
              </div>
            </div>

            {/* Amount */}
            <div>
              <div className="text-sm mb-1">
                Amount <span className="text-red-600">*</span>
              </div>
              <input
                {...register("amount", { required: true })}
                placeholder="e.g. 0.550"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                inputMode="decimal"
              />
            </div>

            {/* Entry / Exit */}
            <div>
              <div className="text-sm mb-1">
                Entry Price <span className="text-red-600">*</span>
              </div>
              <input
                {...register("entry_price", { required: true })}
                placeholder="e.g. 27654.32"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                inputMode="decimal"
              />
            </div>
            <div>
              <div className="text-sm mb-1">Target Exit Price</div>
              <input
                {...register("exit_price")}
                placeholder="e.g. 28000.00"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                inputMode="decimal"
              />
            </div>

            {/* FUTURES ONLY */}
            {wTradeType === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm mb-1">
                    Leverage <span className="text-red-600">*</span>
                  </div>
                  <input
                    {...register("leverage", { required: wTradeType === 2 })}
                    placeholder="e.g. 10x"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <div className="text-sm mb-1">
                    Margin Used <span className="text-red-600">*</span>
                  </div>
                  <input
                    {...register("margin_used", { required: wTradeType === 2 })}
                    placeholder="—"
                    readOnly
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none bg-gray-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm mb-1">
                    Liquidation Price <span className="text-red-600">*</span>
                  </div>
                  <input
                    {...register("liquidation_price", {
                      required: wTradeType === 2,
                    })}
                    placeholder="e.g. 10000.32"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                    inputMode="decimal"
                  />
                </div>
              </div>
            )}

            {/* Rules match */}
            <div>
              <div className="text-sm mb-1">
                How Many Of Your Strategy Rules Did This Setup Follow?{" "}
                <span className="text-red-600">*</span>
              </div>
              <select
                {...register("strategy_rule_match", { required: true })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <div className="text-sm mb-1">Notes (Optional)</div>
              <textarea
                {...register("notes_entry")}
                rows={3}
                placeholder="Write any notes you want to take relating to the trade…"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <div className="text-sm mb-1">Post-Loss Review</div>
              <textarea
                {...register("notes_review")}
                rows={3}
                placeholder="Reflect on what went wrong if you lost or broke even…"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </form>
        </div>
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete entry?"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded-xl bg-orange-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-600">
          This action cannot be undone.
        </div>
      </Modal>

      {/* footer */}
      <footer className="text-xs text-gray-500 py-6 flex items-center gap-6">
        <span>© 2025 Maverik AI. All rights reserved.</span>
        <a href="#" className="hover:underline">
          Support
        </a>
        <a href="#" className="hover:underline">
          Terms
        </a>
        <a href="#" className="hover:underline">
          Privacy
        </a>
      </footer>
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-xl flex items-center gap-3"
    >
      {icon && <span>{icon}</span>}
      <span className="text-sm">{label}</span>
    </button>
  );
}
