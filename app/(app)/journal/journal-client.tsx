"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useForm } from "react-hook-form"
import Card from "@/components/ui/Card"
import Modal from "@/components/ui/Modal"
import { Table, Th, Tr, Td } from "@/components/ui/Table"

type TradeType = 1 | 2
type Status = "in_progress" | "win" | "loss" | "break_even"
type Side = "buy" | "sell" | "long" | "short"

type JournalRow = {
  id: string
  asset_name: string
  trade_type: TradeType
  side: Side
  status: Status
  entry_price: number
  exit_price: number | null
  amount_spent: number
  date: string | Date
  strategy_id: string
  pnl: number | null
  leverage: number | null
  buy_fee: number
  sell_fee: number
  timeframe_code: string
  liquidation_price: number | null
  stop_loss_price: number | null
  strategy_rule_match: number 
  notes_entry: string | null
  notes_review: string | null
}

type StrategyOption = { id: string; name: string | null }
type StrategyWithRules = StrategyOption & { rules: { id: string; title: string }[] }

type JournalForm = {
  strategy_id: string
  asset_name: string
  trade_type: TradeType | string
  trade_datetime: string

  timeframe_number?: string
  timeframe_unit?: "S" | "M" | "H" | "D" | "W" | "Y"
  buy_fee?: string

  side?: Side
  status?: Status
  amount_spent?: string
  entry_price?: string
  exit_price?: string
  stop_loss_price?: string
  leverage?: string
  liquidation_price?: string

  matched_rule_ids?: string[]
  notes_entry?: string
  notes_review?: string
}

type AssetOption = { id: string; symbol: string; name: string }
type JournalSummary = { id: string; name: string; created_at: string }
type JournalsPayload = { items?: JournalSummary[]; activeJournalId?: string | null }
type Rule = { id: string; title: string }
type HasRules = { rules?: Rule[] | undefined }
type HasStrategyRules = { strategy_rules?: Array<{ rule?: Rule | null | undefined }> | undefined }
type MaybeWithRules = HasRules | HasStrategyRules | StrategyWithRules | undefined

function hasRules(x: unknown): x is HasRules {
  return typeof x === "object" && x !== null && Array.isArray((x as HasRules).rules)
}
function hasStrategyRules(x: unknown): x is HasStrategyRules {
  return typeof x === "object" && x !== null && Array.isArray((x as HasStrategyRules).strategy_rules)
}

function toLocalInputValue(dt: string | Date) {
  const d = new Date(dt)
  const pad = (n: number) => String(n).padStart(2, "0")
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function toISO(dtLocal: string): string {
  return new Date(dtLocal).toISOString()
}

const fmt4 = (n: number | null | undefined) => {
  if (n == null) return "—";
  const s = String(n);
  const [i, d = ""] = s.split(".");
  const d4 = d.slice(0, 4);
  const trimmed = d4.replace(/0+$/, "");
  return trimmed ? `${i}.${trimmed}` : i; 
};

const money2 = (n: number) => `$${n.toFixed(2)}`;


type BasePayload = {
  strategy_id: string
  asset_name: string
  trade_datetime: string
  side: Side
  status: Status
  amount_spent: number
  entry_price: number
  exit_price: number | null
  stop_loss_price: number | null
  strategy_rule_match: number
  notes_entry: string | null
  notes_review: string | null
  timeframe_code: string
  buy_fee: number
  sell_fee?: number
}


type CreateSpotPayload = BasePayload & { trade_type: 1 }
type CreateFuturesPayload = BasePayload & {
  trade_type: 2
  futures: { leverage: number; liquidation_price: number | null }
}
type CreatePayload = CreateSpotPayload | CreateFuturesPayload

export default function JournalPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<JournalRow[]>([])
  const [strategies, setStrategies] = useState<StrategyWithRules[]>([])

  const [start, setStart] = useState<string>(() => {
    const end = new Date()
    const s = new Date(new Date().setMonth(end.getMonth() - 6))
    s.setHours(0, 0, 0, 0)
    return s.toISOString().slice(0, 10)
  })
  const [end, setEnd] = useState<string>(() => {
    const d = new Date()
    d.setHours(23, 59, 59, 999)
    return d.toISOString().slice(0, 10)
  })

  const [movedOutBanner, setMovedOutBanner] = useState<string | null>(null)

  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"new" | "az" | "za">("new")
  const [showFilter, setShowFilter] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [assetQuery, setAssetQuery] = useState<string>("")
  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([])
  const [showAssetMenu, setShowAssetMenu] = useState<boolean>(false)
  const [assetError, setAssetError] = useState<string | null>(null)
  const validSymbolsRef = useRef<Set<string>>(new Set())
  const assetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [exportOpen, setExportOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    trigger,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<JournalForm>({
    defaultValues: {
      strategy_id: "",
      asset_name: "",
      trade_type: 1,
      trade_datetime: toLocalInputValue(new Date()),
      timeframe_number: "4",
      timeframe_unit: "H",
      buy_fee: "0", 
      matched_rule_ids: [],
      notes_entry: "",
      notes_review: "",
    },
    mode: "onTouched",
  })

  const wTradeType = Number(watch("trade_type") ?? 1) as TradeType
  const wStatus = watch("status") as Status | undefined
  const wStrategyId = watch("strategy_id")
  const [journals, setJournals] = useState<JournalSummary[]>([])
  const [activeJournalId, setActiveJournalId] = useState<string | null>(null)
  const [activeJournalName, setActiveJournalName] = useState<string>("")

  const [firstRunOpen, setFirstRunOpen] = useState(false)
  const [firstRunName, setFirstRunName] = useState("")
  const [firstRunSaving, setFirstRunSaving] = useState(false)
  const [firstRunError, setFirstRunError] = useState<string | null>(null)

  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [rowToClose, setRowToClose] = useState<JournalRow | null>(null);
  const [closeExit, setCloseExit] = useState<string>("");
  const [closeSellFee, setCloseSellFee] = useState<string>("0");
  const [closePnl, setClosePnl] = useState<number | null>(null);

  const RULE_CACHE_PREFIX = "jrnl.ruleIds."
  const makeRuleKey = (entryId: string) => `${RULE_CACHE_PREFIX}${entryId}`
  function saveRuleIds(entryId: string, ids: string[]) {
    try { localStorage.setItem(makeRuleKey(entryId), JSON.stringify(ids)) } catch {}
  }
  function loadRuleIds(entryId: string): string[] | null {
    try {
      const raw = localStorage.getItem(makeRuleKey(entryId))
      return raw ? (JSON.parse(raw) as string[]) : null
    } catch { return null }
  }
  function clearRuleIds(entryId: string) {
    try { localStorage.removeItem(makeRuleKey(entryId)) } catch {}
}

  useEffect(() => {
    if (typeof window === "undefined") return
    if (loading) return
    if (firstRunOpen) return

    if (journals.length === 0) {
      setFirstRunName("")
      setFirstRunOpen(true)
      return
    }

  }, [loading, journals, firstRunOpen])


  useEffect(() => {
    const cur = watch("side") as Side | undefined
    if (wTradeType === 1) {
      if (cur !== "buy" && cur !== "sell") setValue("side", "buy", { shouldValidate: true })
    } else {
      if (cur !== "long" && cur !== "short") setValue("side", "long", { shouldValidate: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wTradeType])

  function openCloseModal(r: JournalRow) {
    if (r.status !== "in_progress") return;
    setRowToClose(r);
    setCloseExit(r.exit_price != null ? String(r.exit_price) : "");
    setCloseSellFee("0");
    setClosePnl(null);
    setCloseOpen(true);
  }

  useEffect(() => {
    if (!rowToClose) return;
    const exit = parseFloat(closeExit);
    const sellFeeNum = parseFloat(closeSellFee);
    if (isNaN(exit) || isNaN(sellFeeNum)) { setClosePnl(null); return; }
    const dir = (rowToClose.side === "buy" || rowToClose.side === "long") ? 1 : -1;
    const change = (exit - rowToClose.entry_price) / rowToClose.entry_price;
    const notional = rowToClose.trade_type === 2
      ? (rowToClose.amount_spent * Math.max(1, rowToClose.leverage ?? 1))
      : rowToClose.amount_spent;
    const gross = dir * notional * change;
    const buyFee = Number(rowToClose.buy_fee ?? 0);
    const net = gross - (buyFee + sellFeeNum);
    setClosePnl(Number(net.toFixed(2)));
  }, [closeExit, closeSellFee, rowToClose]);

  function buildRangeQS(start: string, end: string) {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate   = new Date(`${end}T23:59:59.999`);
    return new URLSearchParams({
      start: startDate.toISOString(),
      end:   endDate.toISOString(),
    }).toString();
  }

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setMovedOutBanner(null);

      const qs = buildRangeQS(start, end);
      const [jr, st, jn] = await Promise.all([
        fetch(`/api/journal?${qs}`, { cache: "no-store" }),
        fetch(`/api/strategies`,   { cache: "no-store" }),
        fetch(`/api/journals`,     { cache: "no-store" }),
      ]);

      if (!jr.ok) throw new Error(await jr.text());
      if (!st.ok) throw new Error(await st.text());

      const j = (await jr.json()) as { items: JournalRow[] };
      setItems(j.items);

      const sPayload:
        | { items?: Array<{ id: string; name: string | null; strategy_rules?: Array<{ rule: { id: string; title: string } }> }> }
        | Array<{ id: string; name: string | null }>
        = await st.json();

      const arr: StrategyWithRules[] = Array.isArray(sPayload)
        ? sPayload.map((x) => {
            const prev = strategiesRef.current.find(s => s.id === x.id);
            return { id: x.id, name: x.name, rules: prev?.rules ?? [] };
          })
        : (sPayload.items ?? []).map((x) => ({
            id: x.id,
            name: x.name,
            rules: (x.strategy_rules ?? []).map((sr) => ({ id: sr.rule.id, title: sr.rule.title })),
          }));
      setStrategies(arr);

      if (!jn.ok) throw new Error(await jn.text());
      const jnPayload = (await jn.json()) as JournalsPayload;
      const list = jnPayload.items ?? [];
      setJournals(list);
      setActiveJournalId(jnPayload.activeJournalId ?? null);

      const name = list.find(x => x.id === (jnPayload.activeJournalId ?? ""))?.name ?? "";
      setActiveJournalName(name);

      return j.items;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load journal");
      return [];
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  const wTfNum = watch("timeframe_number");
  const wTfUnit = watch("timeframe_unit");
  const wExit = watch("exit_price");
  const wEntry = watch("entry_price");
  const wSide = watch("side");
  const hasExit = !!(wExit && String(wExit).trim());

  const derivedStatus = useMemo<Status | null>(() => {
    const ex = parseFloat(String(wExit ?? ""));
    const en = parseFloat(String(wEntry ?? ""));
    if (!(ex > 0) || !(en > 0)) return null;
    const longLike = wSide === "buy" || wSide === "long";
    if (ex === en) return "break_even";
    return longLike ? (ex > en ? "win" : "loss") : (ex < en ? "win" : "loss");
  }, [wExit, wEntry, wSide]);

  useEffect(() => {
    try {
      if (wTfNum && /^\d+$/.test(String(wTfNum)) && ["S","M","H","D","W","Y"].includes(String(wTfUnit))) {
        localStorage.setItem("jrnl.lastTf", JSON.stringify({ num: String(wTfNum), unit: String(wTfUnit) }));
      }
    } catch {}
  }, [wTfNum, wTfUnit]);

  useEffect(() => { void load() }, [load])

  useEffect(() => {
  try {
      const saved = JSON.parse(localStorage.getItem("jrnl.range") || "{}");
      if (saved.start) setStart(saved.start);
      if (saved.end) setEnd(saved.end);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("jrnl.range", JSON.stringify({ start, end })); } catch {}
  }, [start, end]);

  const rows = useMemo(() => {
    let arr = items
    const q = query.trim().toLowerCase()
    if (q) arr = arr.filter((i) => `${i.asset_name} ${i.status} ${i.side}`.toLowerCase().includes(q))
    switch (sort) {
      case "az": return [...arr].sort((a, b) => a.asset_name.localeCompare(b.asset_name))
      case "za": return [...arr].sort((a, b) => b.asset_name.localeCompare(a.asset_name))
      default:   return [...arr].sort((a, b) => +new Date(b.date) - +new Date(a.date))
    }
  }, [items, query, sort])

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setWizardStep(1);

    validSymbolsRef.current = new Set();
    setAssetQuery("");
    setAssetOptions([]);
    setShowAssetMenu(false);

    reset({
      strategy_id: "",
      asset_name: "",
      trade_type: 1,
      trade_datetime: toLocalInputValue(new Date()),
      matched_rule_ids: [],
      notes_entry: "",
      notes_review: "",
    });

    setValue("side", "buy", { shouldValidate: false, shouldDirty: false });

    let lastTfNum = "4";
    let lastTfUnit: JournalForm["timeframe_unit"] = "H";
    try {
      const saved = JSON.parse(localStorage.getItem("jrnl.lastTf") || "{}");
      if (
        saved &&
        /^\d+$/.test(saved.num) &&
        ["S","M","H","D","W","Y"].includes(saved.unit)
      ) {
        lastTfNum = saved.num;
        lastTfUnit = saved.unit;
      }
    } catch {}

    setValue("timeframe_number", lastTfNum, { shouldValidate: false, shouldDirty: false });
    setValue("timeframe_unit", lastTfUnit,   { shouldValidate: false, shouldDirty: false });
    setValue("buy_fee", "0", { shouldValidate: false, shouldDirty: false });

    setOpen(true);
  }

  function openEdit(row: JournalRow) {
    setMode("edit")
    setEditingId(row.id)
    setWizardStep(1)

    validSymbolsRef.current = new Set([row.asset_name.toUpperCase()])
    setAssetQuery(row.asset_name)
    setAssetOptions([])
    setShowAssetMenu(false)

    reset({
      strategy_id: row.strategy_id,
      asset_name: row.asset_name,
      trade_type: row.trade_type,
      trade_datetime: toLocalInputValue(row.date),
      side: row.side,
      status: row.status,
      amount_spent: String(row.amount_spent),
      entry_price: String(row.entry_price),
      exit_price: row.exit_price != null ? String(row.exit_price) : "",
      stop_loss_price: row.stop_loss_price != null ? String(row.stop_loss_price) : "",
      leverage: row.leverage != null ? String(row.leverage) : "",
      liquidation_price: row.liquidation_price != null ? String(row.liquidation_price) : "",
      matched_rule_ids: [],
      notes_entry: row.notes_entry ?? "",
      notes_review: row.notes_review ?? "",
    })
    const tf = row.timeframe_code || "";
    const tfNum = tf.replace(/[A-Z]$/i, "");
    const tfUnit = tf.slice(-1).toUpperCase() as "S"|"M"|"H"|"D"|"W"|"Y";
    setValue("timeframe_number", tfNum || "1", { shouldValidate: false });
    setValue(
      "timeframe_unit",
      (["S","M","H","D","W","Y"].includes(tfUnit) ? tfUnit : "H") as JournalForm["timeframe_unit"],
      { shouldValidate: false }
    );
    setValue("buy_fee", String(row.buy_fee ?? 0), { shouldValidate: false });
    setValue("strategy_id", row.strategy_id, { shouldValidate: false, shouldDirty: false })

    const rulesForStrategy = normalizeRules(
      strategiesRef.current.find(s => s.id === row.strategy_id)
    )
    setStrategyRules(rulesForStrategy)

    const cached = loadRuleIds(row.id)
    const validIds = new Set(rulesForStrategy.map(r => r.id))
    const cachedFiltered = Array.isArray(cached) ? cached.filter(id => validIds.has(id)) : []

    if (cachedFiltered.length) {
      setValue("matched_rule_ids", cachedFiltered, { shouldDirty: false })
    } else {
      const prechecked = rulesForStrategy.slice(0, row.strategy_rule_match || 0).map(r => r.id)
      setValue("matched_rule_ids", prechecked, { shouldDirty: false })
    }

    if (!rulesForStrategy.length) {
      ;(async () => {
        try {
          const r = await fetch(`/api/strategies/${row.strategy_id}`, { cache: "no-store" })
          if (!r.ok) return
          const data: unknown = await r.json()
          const normalized = normalizeRules(data as MaybeWithRules)
          setStrategyRules(normalized)

          const valid2 = new Set(normalized.map(rr => rr.id))
          const cached2 = loadRuleIds(row.id)
          const cached2Filtered = Array.isArray(cached2) ? cached2.filter(id => valid2.has(id)) : []
          if (cached2Filtered.length) {
            setValue("matched_rule_ids", cached2Filtered, { shouldDirty: false })
          } else {
            const pre = normalized.slice(0, row.strategy_rule_match || 0).map(rr => rr.id)
            setValue("matched_rule_ids", pre, { shouldDirty: false })
          }
        } catch {}
      })()
    }

    setOpen(true)
  }

  function askDelete(id: string) {
    setDeleteId(id)
    setConfirmOpen(true)
  }

  async function confirmDelete() {
    if (!deleteId) return
    try {
      setDeleting(true)
      const r = await fetch(`/api/journal/${deleteId}`, { method: "DELETE" })
      if (!r.ok) throw new Error(await r.text())
      setConfirmOpen(false)
      setDeleteId(null)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
    clearRuleIds(deleteId)
  }

  async function validateAndNext() {
    if (wizardStep === 1) {
      const ok = await trigger(["strategy_id", "asset_name", "trade_type", "trade_datetime"])
      if (ok) setWizardStep(2)
      return
    }
    if (wizardStep === 2) {
      if (wTradeType === 1) {
        const ok = await trigger(["status", "amount_spent", "entry_price", "buy_fee"])
        if (ok) setWizardStep(3)
      } else {
      const ok = await trigger(["amount_spent", "entry_price", "leverage", "buy_fee", "status", "side"])
        if (ok) setWizardStep(3)
      }
      return
    }
  }

  async function submitFinal(form: JournalForm) {
    const tradeType = Number(form.trade_type) as TradeType;
    const ruleCount = (form.matched_rule_ids ?? []).length;

    let coercedSide: Side = (form.side ?? "buy") as Side;
    coercedSide =
      tradeType === 1
        ? (coercedSide === "sell" ? "sell" : "buy")
        : (coercedSide === "short" ? "short" : "long");

    const timeframe_code = `${(form.timeframe_number ?? "").trim()}${form.timeframe_unit ?? ""}`.toUpperCase();

    const base: Omit<BasePayload, "sell_fee"> & { sell_fee?: number } = {
      strategy_id: form.strategy_id,
      asset_name: form.asset_name,
      trade_datetime: toISO(form.trade_datetime),
      side: coercedSide,
      status: (form.status ?? "in_progress") as Status,
      amount_spent: Number(form.amount_spent ?? 0),
      entry_price: Number(form.entry_price ?? 0),
      exit_price: form.exit_price ? Number(form.exit_price) : null,
      stop_loss_price: form.stop_loss_price ? Number(form.stop_loss_price) : null,
      strategy_rule_match: ruleCount,
      notes_entry: form.notes_entry?.trim() || null,
      notes_review: form.notes_review?.trim() || null,
      timeframe_code,
      buy_fee: Number(form.buy_fee ?? 0),
    };

    if (base.status === "in_progress") {
      base.sell_fee = 0;
    }

    let payload: CreatePayload;
    if (tradeType === 2) {
      const liq = form.liquidation_price?.trim()
        ? Number(form.liquidation_price)
        : null;

      const futures: CreateFuturesPayload["futures"] = {
        leverage: Number(form.leverage ?? 0),
        liquidation_price: liq,
      };

      payload = { ...base, trade_type: 2, futures };
    } else {
      payload = { ...base, trade_type: 1 };
    }

    const url = mode === "create" ? "/api/journal" : `/api/journal/${editingId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
      if (!r.ok) throw new Error(await r.text());

    const savedDate = new Date(base.trade_datetime);
    const startDate = new Date(`${start}T00:00:00`);
    const endDate   = new Date(`${end}T23:59:59.999`);

    await load();

    const isOutside =
      savedDate.getTime() < startDate.getTime() || savedDate.getTime() > endDate.getTime();

    if (isOutside) {
      setMovedOutBanner(
        mode === "edit"
          ? "Heads-up: the edited trade is outside the current date range filter."
          : "Heads-up: the new trade is outside the current date range filter."
      );
    }
  }

  const onSubmit = async (form: JournalForm) => {
    try {
      await submitFinal(form)
        if (mode === "edit" && editingId) {
          saveRuleIds(editingId, form.matched_rule_ids ?? [])
        }
      setOpen(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save")
    }
  }

  async function fetchAssets(q: string) {
    try {
      setAssetError(null)
      if (q.trim().length < 1) {
        setAssetOptions([]); setShowAssetMenu(false)
        return
      }
      const r = await fetch(`/api/assets/coins?q=${encodeURIComponent(q)}`)
      if (!r.ok) throw new Error("Lookup failed")
      const { items } = (await r.json()) as { items: AssetOption[] }
      setAssetOptions(items)
      validSymbolsRef.current = new Set(items.map(i => i.symbol.toUpperCase()))
      setShowAssetMenu(items.length > 0)
    } catch (e) {
      setAssetError("Could not load assets")
      setAssetOptions([]); setShowAssetMenu(false)
    }
  }

  const totalTrades = rows.length;
  const finished = rows.filter(r => r.status !== "in_progress");
  const winRate = finished.length
    ? Math.round((finished.filter(i => i.status === "win").length * 100) / finished.length)
    : 0;

  const earnings = rows.reduce((acc, r) => acc + (r.pnl ?? 0), 0)

  const [strategyRules, setStrategyRules] = useState<Rule[]>([])

  const strategiesRef = useRef<StrategyWithRules[]>([])
  useEffect(() => { strategiesRef.current = strategies }, [strategies])

  function normalizeRules(payload: MaybeWithRules): Rule[] {
    if (!payload) return []

    if (hasRules(payload) && payload.rules) {
      return payload.rules.map(r => ({ id: r.id, title: r.title }))
    }

    if (hasStrategyRules(payload) && payload.strategy_rules) {
      return payload.strategy_rules
        .map(sr => sr.rule)
        .filter((r): r is Rule => !!r)
        .map(r => ({ id: r.id, title: r.title }))
    }

    return []
  }

  useEffect(() => {
  let abort = false
  async function loadRules() {
    if (!wStrategyId) return

    const fromList = normalizeRules(
      strategiesRef.current.find(s => s.id === wStrategyId)
    )
    if (fromList.length) {
      if (!abort) setStrategyRules(fromList)
    }

    try {
      const r = await fetch(`/api/strategies/${wStrategyId}`, { cache: "no-store" })
      if (!r.ok) throw new Error(await r.text())
      const data: unknown = await r.json()
      const normalized = normalizeRules(data as MaybeWithRules)
      if (!abort) setStrategyRules(normalized)
    } catch {
      if (!abort) setStrategyRules(fromList ?? [])
    }
  }
  void loadRules()
    return () => { abort = true }
  }, [wStrategyId, open])


  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          Active Journal:
          <span className="ml-2 inline-flex items-center rounded-full bg-white px-3 py-1 shadow-sm border text-gray-700">
            {activeJournalName || "—"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/journals"
            className="flex items-center gap-2 rounded-xl bg-white text-gray-700 px-3 py-2 shadow-sm hover:bg-gray-50"
            title="Manage journals"
          >
            📒 Manage Journals
          </a>
         <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-white text-gray-700 px-3 py-2 shadow-sm hover:bg-gray-50">
          📄 Export
        </button>
          <button onClick={openCreate} className="h-10 w-10 rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-50">＋</button>
        </div>
    </div>
      {movedOutBanner && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{movedOutBanner}</div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <div className="flex justify-between">
            <div className="flex flex-col">
              <div className="text-sm text-gray-600">Total Trades</div>
              <div className="mt-2 text-2xl font-semibold">{totalTrades}</div>
            </div>
            <div className="right-0 top-0 h-10 w-10 grid place-items-center rounded-full bg-yellow-400 text-white">👥</div>
          </div>
        </Card>
        <Card>
          <div className="flex justify-between">
            <div className="flex flex-col">
              <div className="text-sm text-gray-600">Win Rate</div>
              <div className="mt-2 text-2xl font-semibold">{winRate}%</div>
            </div>
            <div className="right-0 top-0  h-10 w-10 grid place-items-center rounded-full bg-purple-500 text-white">👁️</div>
          </div>
        </Card>
        <Card>
          <div className="flex justify-between">
            <div className="flex flex-col">
              <div className="text-sm text-gray-600">Earnings</div>
              <div className="mt-2 text-2xl font-semibold">{earnings ? `$${earnings.toFixed(2)}` : "$0.00"}</div>
            </div>
            <div className="right-6 top-6 h-10 w-10 grid place-items-center rounded-full bg-orange-500 text-white">$</div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-gray-600">Date range:</div>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2" />
          <span className="text-gray-400">—</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2" />
          <button className="rounded-xl bg-white px-3 py-2 text-sm border" onClick={() => void load()}>
            Apply
          </button>
        </div>
      </Card>

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
              <button onClick={() => setShowSearch(false)} className="text-gray-400 hover:text-gray-600">✖</button>
            </div>
          </div>
        )}

        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Trades</h3>
          <div className="flex items-center gap-3 relative">
            <button onClick={() => setShowSearch((s) => !s)} className="p-2 rounded-full hover:bg-gray-100">🔍</button>
            <div className="relative">
              <button onClick={() => { setShowFilter((f) => !f); setShowMenu(false) }} className="p-2 rounded-full hover:bg-gray-100">🧰</button>
              {showFilter && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-20" onMouseLeave={() => setShowFilter(false)}>
                  <MenuItem label="Newest" onClick={() => { setSort("new"); setShowFilter(false) }} icon="🧾" />
                  <MenuItem label="From A-Z" onClick={() => { setSort("az"); setShowFilter(false) }} icon="🔤" />
                  <MenuItem label="From Z-A" onClick={() => { setSort("za"); setShowFilter(false) }} icon="🔠" />
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => { setShowMenu((m) => !m); setShowFilter(false) }} className="p-2 rounded-full hover:bg-gray-100">⋯</button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-20" onMouseLeave={() => setShowMenu(false)}>
                  <MenuItem label="Refresh" onClick={() => { void load(); setShowMenu(false) }} />
                  <MenuItem label="Manage Widgets" onClick={() => setShowMenu(false)} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-2 overflow-x-auto">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-red-600">{error}</div>
          ) : (
            <Table className="min-w-[900px] md:min-w-full">
              <thead>
                <tr>
                  <Th className="whitespace-nowrap w-28 md:w-36">Asset</Th>
                  <Th className="whitespace-nowrap w-20 md:w-24">Type</Th>
                  <Th className="whitespace-nowrap w-20 md:w-24">Side</Th>
                  <Th className="whitespace-nowrap text-right w-28">Entry</Th>
                  <Th className="whitespace-nowrap text-right w-28">Exit</Th>
                  <Th className="whitespace-nowrap text-right w-36">Amount Spent</Th>
                  <Th className="whitespace-nowrap text-right w-28">PnL</Th>
                  <Th className="whitespace-nowrap hidden md:table-cell w-56">Date</Th>
                  <Th className="whitespace-nowrap w-16 text-center">TF</Th>
                  <Th className="whitespace-nowrap w-40">Status / Action</Th>
                  <Th className="w-12"></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <Tr key={r.id}>
                    <Td className="whitespace-nowrap w-28 md:w-36">{r.asset_name}</Td>
                    <Td className="whitespace-nowrap w-20 md:w-24">{r.trade_type === 2 ? "Futures" : "Spot"}</Td>
                    <Td className="whitespace-nowrap w-20 md:w-24">{r.side}</Td>

                    <Td className="text-right font-mono w-28">{fmt4(r.entry_price)}</Td>
                    <Td className="text-right font-mono w-28">{r.exit_price != null ? fmt4(r.exit_price) : "—"}</Td>

                    <Td className="text-right font-mono w-36">{money2(r.amount_spent)}</Td>
                    <Td className="text-right font-mono w-28">{r.pnl != null ? money2(r.pnl) : "—"}</Td>

                    <Td className="hidden md:table-cell">{new Date(r.date).toLocaleString()}</Td>
                    <Td className="text-center w-16">{r.timeframe_code}</Td>

                    <Td className="w-40">
                      {r.status === "in_progress" ? (
                        <button
                          title="Close Trade"
                          onClick={() => openCloseModal(r)}
                          className="px-2 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700">
                          Close Trade
                        </button>
                      ) : (
                        <span className="text-xs text-gray-600">{r.status.replace("_", " ")}</span>
                      )}
                    </Td>

                    <Td className="w-12">
                      <div className="flex gap-3 justify-end">
                        <button title="Edit" onClick={() => openEdit(r)} className="text-gray-600 hover:text-gray-800">✏️</button>
                        <button title="Delete" onClick={() => askDelete(r.id)} className="text-orange-600 hover:text-orange-700">🗑️</button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "Add Trade" : "Edit Trade"}
        footer={
          <div className="flex items-center justify-between">
            <div>
              {wizardStep > 1 && (
                <button
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
                  onClick={() => setWizardStep((s) => (s === 2 ? 1 : 2))}
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200" onClick={() => setOpen(false)}>Cancel</button>
              {wizardStep < 3 ? (
                <button className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm hover:opacity-90" onClick={() => void validateAndNext()}>
                  Next
                </button>
              ) : (
                <button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50">
                  {mode === "create" ? "Add Trade" : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <form className="grid gap-4" onSubmit={() =>{}}>
            {wizardStep === 1 && (
              <>
                <div>
                  <div className="text-sm mb-1">
                    Strategy Used <span className="text-red-600">*</span>
                  </div>
                  <select
                    {...register("strategy_id", { required: "Strategy is required" })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  >
                    <option value="">Select a strategy…</option>
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || "Untitled"}
                      </option>
                    ))}
                  </select>
                  {errors.strategy_id && <p className="mt-1 text-xs text-red-600">{String(errors.strategy_id.message)}</p>}
                </div>

                <div>
                  <div className="text-sm mb-1">
                    Asset <span className="text-red-600">*</span>
                  </div>
                  <input
                    {...register("asset_name", {
                      required: "Asset is required",
                      validate: (v) =>
                        validSymbolsRef.current.has((v ?? "").toUpperCase()) || "Pick an asset from the list",
                    })}
                    value={assetQuery}
                    onChange={(e) => {
                      const q = e.target.value
                      setAssetQuery(q)
                      setValue("asset_name", q, { shouldValidate: true })
                      if (assetTimer.current) clearTimeout(assetTimer.current)
                      assetTimer.current = setTimeout(() => { void fetchAssets(q) }, 300)
                    }}
                    onFocus={() => {
                      if (assetOptions.length > 0) setShowAssetMenu(true)
                    }}
                    placeholder="e.g. BTC"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  />
                  {showAssetMenu && (
                    <div className="mt-1 rounded-xl border bg-white shadow-sm max-h-56 overflow-auto">
                      {assetOptions.map((opt) => (
                        <button
                          type="button"
                          key={opt.id}
                          onClick={() => {
                            setAssetQuery(opt.symbol)
                            setValue("asset_name", opt.symbol, { shouldValidate: true })
                            validSymbolsRef.current = new Set([opt.symbol.toUpperCase()])
                            setShowAssetMenu(false)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        >
                          {opt.symbol} — {opt.name}
                        </button>
                      ))}
                      {assetOptions.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">No results</div>
                      )}
                    </div>
                  )}
                  {assetError && <p className="mt-1 text-xs text-amber-700">{assetError}</p>}
                  {errors.asset_name && <p className="mt-1 text-xs text-red-600">{String(errors.asset_name.message)}</p>}
                </div>

                <div>
                  <div className="text-sm mb-1">
                    Trade Type <span className="text-red-600">*</span>
                  </div>
                  <select
                    {...register("trade_type", { required: "Trade type is required" })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  >
                    <option value={1}>Spot</option>
                    <option value={2}>Futures</option>
                  </select>
                  {errors.trade_type && <p className="mt-1 text-xs text-red-600">{String(errors.trade_type.message)}</p>}
                </div>

                <div>
                  <div className="text-sm mb-1">
                    Date & Time <span className="text-red-600">*</span>
                  </div>
                  <input
                    type="datetime-local"
                    {...register("trade_datetime", {
                      required: "Date & time is required",
                      validate: (v) => {
                        const d = new Date(v)
                        const now = new Date()
                        return d.getTime() <= now.getTime() + 2 * 60 * 1000 || "Date/time cannot be in the future"
                      }
                    })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  />
                  {errors.trade_datetime && <p className="mt-1 text-xs text-red-600">{String(errors.trade_datetime.message)}</p>}
                </div>

                <div>
                  <div className="text-sm mb-1">
                    Timeframe <span className="text-red-600">*</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      {...register("timeframe_number", {
                        required: "Timeframe number is required",
                        validate: (v) => /^\d+$/.test(String(v ?? "")) || "Only digits",
                      })}
                      placeholder="e.g. 1"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2"
                    />
                    <select
                      {...register("timeframe_unit", { required: "Unit is required" })}
                      className="rounded-xl border border-gray-200 px-3 py-2"
                    >
                      {["S","M","H","D","W","Y"].map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  {errors.timeframe_number && <p className="mt-1 text-xs text-red-600">{String(errors.timeframe_number.message)}</p>}
                  {errors.timeframe_unit && <p className="mt-1 text-xs text-red-600">{String(errors.timeframe_unit.message)}</p>}
                </div>
              </>
            )}

            {wizardStep === 2 && (
              <>
                {wTradeType === 1 ? (
                  <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm mb-1">Status</div>
                      <select
                        {...register("status", { required: "Status is required" })}
                        onChange={(e) => {
                          const val = e.target.value as Status;
                          setValue("status", val, { shouldDirty: true, shouldValidate: true });
                        }}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                      >
                        <option value="in_progress">In Progress</option>
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="break_even">Break-Even</option>
                      </select>
                    </div>

                    <div>
                      <div className="text-sm mb-1">
                        Buy Fee <span className="text-red-600">*</span>
                      </div>
                      <input
                        {...register("buy_fee", {
                          required: "Buy fee is required",
                          validate: (v) => parseFloat(v ?? "0") >= 0 || "Must be ≥ 0",
                        })}
                        defaultValue="0"
                        inputMode="decimal"
                        placeholder="0"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                      />
                      {errors.buy_fee && (
                        <p className="mt-1 text-xs text-red-600">{String(errors.buy_fee.message)}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm mb-1">
                      Amount Spent <span className="text-red-600">*</span>
                    </div>
                    <input
                      {...register("amount_spent", {
                        required: "Amount spent is required",
                        validate: (v) => parseFloat(v ?? "0") > 0 || "Must be > 0",
                      })}
                      inputMode="decimal"
                      placeholder="e.g. 500.00"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2"
                    />
                    {errors.amount_spent && <p className="mt-1 text-xs text-red-600">{String(errors.amount_spent.message)}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm mb-1">
                        Entry Price <span className="text-red-600">*</span>
                      </div>
                      <input
                        {...register("entry_price", {
                          required: "Entry price is required",
                          validate: (v) => parseFloat(v ?? "0") > 0 || "Must be > 0",
                        })}
                        inputMode="decimal"
                        placeholder="e.g. 27654.32"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                      />
                      {errors.entry_price && <p className="mt-1 text-xs text-red-600">{String(errors.entry_price.message)}</p>}
                    </div>
                  </div>
                    <div>
                      <div className="text-sm mb-1">Exit Price</div>
                      <input
                        {...register("exit_price")}
                        inputMode="decimal"
                        placeholder="e.g. 28000.00"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                      />
                    </div>

                    <div>
                      <div className="text-sm mb-1">Stop Loss Price</div>
                      <input
                        {...register("stop_loss_price")}
                        inputMode="decimal"
                        placeholder="e.g. 25000.00"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-sm mb-1">
                        Amount Spent <span className="text-red-600">*</span>
                      </div>
                      <input
                        {...register("amount_spent", {
                          required: "Amount spent is required",
                          validate: (v) =>
                            parseFloat(v ?? "0") > 0 ? true : "Must be > 0",
                        })}
                        inputMode="decimal"
                        placeholder="e.g. 1000.00"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                      />
                      {errors.amount_spent && (
                        <p className="mt-1 text-xs text-red-600">
                          {String(errors.amount_spent.message)}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm mb-1">
                          Entry Price <span className="text-red-600">*</span>
                        </div>
                        <input
                          {...register("entry_price", {
                            required: "Entry price is required",
                            validate: (v) =>
                              parseFloat(v ?? "0") > 0 ? true : "Must be > 0",
                          })}
                          inputMode="decimal"
                          placeholder="e.g. 27654.32"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        />
                        {errors.entry_price && (
                          <p className="mt-1 text-xs text-red-600">
                            {String(errors.entry_price.message)}
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="text-sm mb-1">Exit Price</div>
                        <input
                          {...register("exit_price")}
                          inputMode="decimal"
                          placeholder="e.g. 28000.00"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        />
                      </div>
                      <div>
                        <div className="text-sm mb-1">Stop Loss Price</div>
                        <input
                          {...register("stop_loss_price")}
                          inputMode="decimal"
                          placeholder="e.g. 25000.00"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm mb-1">
                          Buy Fee <span className="text-red-600">*</span>
                        </div>
                        <input
                          {...register("buy_fee", {
                            required: "Buy fee is required",
                            validate: (v) => parseFloat(v ?? "0") >= 0 || "Must be ≥ 0",
                          })}
                          defaultValue="0"
                          inputMode="decimal"
                          placeholder="0"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        />
                        {errors.buy_fee && (
                          <p className="mt-1 text-xs text-red-600">{String(errors.buy_fee.message)}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm mb-1">
                          Leverage <span className="text-red-600">*</span>
                        </div>
                        <input
                          {...register("leverage", {
                            required: "Leverage is required",
                            validate: (v) =>
                              parseFloat(v ?? "0") > 0 ? true : "Must be > 0",
                          })}
                          placeholder="e.g. 10"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        />
                        {errors.leverage && (
                          <p className="mt-1 text-xs text-red-600">
                            {String(errors.leverage.message)}
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="text-sm mb-1">Liquidation Price (optional)</div>
                        <input
                          {...register("liquidation_price")}
                          inputMode="decimal"
                          placeholder="e.g. 10000.32"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-sm mb-1">Status</div>
                      <select
                        {...register("status", { required: "Status is required" })}
                        onChange={(e) => {
                          const val = e.target.value as Status;
                          setValue("status", val, { shouldDirty: true, shouldValidate: true });
                        }}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                      >
                        <option value="in_progress">In Progress</option>
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="break_even">Break-Even</option>
                      </select>
                      {errors.status && (
                        <p className="mt-1 text-xs text-red-600">{String(errors.status.message)}</p>
                      )}
                    </div>
                    <div>
                      <div className="text-sm mb-1">Side</div>
                      <select
                        {...register("side", { required: "Side is required" })}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                      >
                        <option value="long">Long</option>
                        <option value="short">Short</option>
                      </select>
                      {errors.side && (
                        <p className="mt-1 text-xs text-red-600">
                          {String(errors.side.message)}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
            {wizardStep === 3 && (
              <>
                 <div>
                  <div className="text-sm mb-2">
                    How Many Strategy Rules Did Your Setup Follow? (Optional)
                  </div>
                  <div className="grid gap-2">
                    {strategyRules.length ? (
                      strategyRules.map((r) => (
                        <label key={r.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" value={r.id} {...register("matched_rule_ids")} />
                          <span>{r.title}</span>
                        </label>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500">No rules for selected strategy.</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm mb-1">Notes (Optional)</div>
                  <textarea {...register("notes_entry")} rows={3} placeholder="Write any notes…" className="w-full rounded-xl border border-gray-200 px-3 py-2" />
                </div>

                {(wStatus === "loss" || wStatus === "break_even") && (
                  <div>
                    <div className="text-sm mb-1">Post Loss Review (Optional)</div>
                    <textarea {...register("notes_review")} rows={3} placeholder="Reflect on what went wrong…" className="w-full rounded-xl border border-gray-200 px-3 py-2" />
                  </div>
                )}
              </>
            )}
          </form>
        </div>
      </Modal>

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export"
        footer={
          <div className="flex justify-end">
            <button
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
              onClick={() => setExportOpen(false)}
            >
              OK
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-700">
          This feature is coming soon.
        </div>
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete entry?"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200" onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
            <button onClick={confirmDelete} disabled={deleting} className="rounded-xl bg-orange-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50">
              Delete
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-600">This action cannot be undone.</div>
      </Modal>
      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Quick Close"
        footer={
          <div className="flex justify-end gap-3">
            <button className="rounded bg-gray-100 px-4 py-2 text-sm" onClick={() => setCloseOpen(false)}>
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!rowToClose) return;
                const exitNum = parseFloat(closeExit);
                const sellFeeNum = parseFloat(closeSellFee);
                if (!(exitNum > 0)) { alert("Exit price is required"); return; }
                if (!(sellFeeNum >= 0)) { alert("Sell fee must be ≥ 0"); return; }
                try {
                  setClosing(true);
                  const computedStatus: Status = (() => {
                    if (!rowToClose) return "win";
                    if (exitNum === rowToClose.entry_price) return "break_even";
                    const longLike = rowToClose.side === "buy" || rowToClose.side === "long";
                    return (longLike ? (exitNum > rowToClose.entry_price) : (exitNum < rowToClose.entry_price))
                      ? "win"
                      : "loss";
                  })();

                  const baseClose: BasePayload = {
                  strategy_id: rowToClose.strategy_id,
                  asset_name: rowToClose.asset_name,
                  trade_datetime: toISO(toLocalInputValue(rowToClose.date)),
                  side: rowToClose.side,
                  status: computedStatus,
                  amount_spent: rowToClose.amount_spent,
                  entry_price: rowToClose.entry_price,
                  exit_price: exitNum,
                  stop_loss_price: rowToClose.stop_loss_price ?? null,
                  strategy_rule_match: rowToClose.strategy_rule_match ?? 0,
                  notes_entry: rowToClose.notes_entry ?? null,
                  notes_review: rowToClose.notes_review ?? null,
                  timeframe_code: rowToClose.timeframe_code,
                  buy_fee: rowToClose.buy_fee ?? 0,
                  sell_fee: sellFeeNum,
                };

                const payloadClose: CreatePayload =
                  rowToClose.trade_type === 2
                    ? {
                        ...baseClose,
                        trade_type: 2,
                        futures: {
                          leverage: rowToClose.leverage ?? 1,
                          liquidation_price: rowToClose.liquidation_price ?? null,
                        },
                      }
                    : {
                        ...baseClose,
                        trade_type: 1,
                      };

                const r = await fetch(`/api/journal/${rowToClose.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payloadClose),
                });
                  if (!r.ok) throw new Error(await r.text());
                  setCloseOpen(false);
                  await load();
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Failed to close");
                } finally {
                  setClosing(false);
                }
              }}
              disabled={closing}
              className="rounded bg-red-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50">
               Close Trade
            </button>
          </div>
        }
      >
        {rowToClose && (
          <div className="grid gap-3 pr-1">

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-gray-500">Entry</div>
                <div className="font-mono">{fmt4(rowToClose.entry_price)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Exit</div>
                <input
                  value={closeExit}
                  onChange={(e) => setCloseExit(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                />
              </div>
              <div>
                <div className="text-xs text-gray-500">PnL (net)</div>
                <div className="font-mono">{closePnl != null ? money2(closePnl) : "—"}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-gray-500">Sell Fee <span className="text-red-600">*</span></div>
                <input
                  value={closeSellFee}
                  onChange={(e) => setCloseSellFee(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={firstRunOpen}
        onClose={() => setFirstRunOpen(false)}
        title="Name your journal"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
              onClick={() => setFirstRunOpen(false)}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!firstRunName.trim()) {
                  setFirstRunError("Please enter a name.")
                  return
                }
                setFirstRunSaving(true)
                setFirstRunError(null)
                try {
                  if (journals.length === 0) {
                    const r = await fetch("/api/journals", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: firstRunName.trim() }),
                    })
                    if (!r.ok) throw new Error(await r.text())
                    const created = (await r.json()) as { id: string }

                    await fetch("/api/journal/active", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: created.id }),
                    })
                  } else if (
                    journals.length === 1 &&
                    journals[0].name?.toLowerCase() === "main"
                  ) {
                    const r = await fetch(`/api/journals/${journals[0].id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: firstRunName.trim() }),
                    })
                    if (!r.ok) throw new Error(await r.text())
                  } else {
                    // should not happen
                  }

                  await load()
                  setFirstRunOpen(false)
                } catch (e) {
                  setFirstRunError(e instanceof Error ? e.message : "Failed to save")
                } finally {
                  setFirstRunSaving(false)
                }
              }}
              disabled={firstRunSaving}
              className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {firstRunSaving ? "Saving..." : "Save"}
            </button>
          </div>
        }
      >
        <div className="grid gap-2">
          <p className="text-sm text-gray-600">
            Choose a name for your first journal. You can manage journals later in “Manage Journals”.
          </p>
          <input
            value={firstRunName}
            onChange={(e) => setFirstRunName(e.target.value)}
            placeholder="e.g. Crypto Journal"
            className="w-full rounded-xl border border-gray-200 px-3 py-2"
            autoFocus
          />
          {firstRunError && (
            <p className="text-xs text-red-600">{firstRunError}</p>
          )}
        </div>
      </Modal>

      <footer className="text-xs text-gray-500 py-6 flex items-center gap-6">
        <span>© 2025 Maverik AI. All rights reserved.</span>
        <a href="#" className="hover:underline">Support</a>
        <a href="#" className="hover:underline">Terms</a>
        <a href="#" className="hover:underline">Privacy</a>
      </footer>
    </div>
  )
}

function MenuItem({ label, onClick, icon }: { label: string; onClick: () => void; icon?: string }) {
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-xl flex items-center gap-3">
      {icon && <span>{icon}</span>}
      <span className="text-sm">{label}</span>
    </button>
  )
}
