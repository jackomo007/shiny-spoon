"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import Modal from "@/components/ui/Modal";
import { MoneyField, DecimalField } from "@/components/form/MaskedFields";
import JournalToolbar from "@/components/journal/JournalToolbar";
import JournalSummaryCards from "@/components/journal/JournalSummaryCards";
import JournalDateRangeCard from "@/components/journal/JournalDateRangeCard";
import JournalTradesCard from "@/components/journal/JournalTradesCard";
import ExportModal from "@/components/journal/ExportModal";
import DeleteEntryModal from "@/components/journal/DeleteEntryModal";
import QuickCloseModal from "@/components/journal/QuickCloseModal";
import FirstRunJournalModal from "@/components/journal/FirstRunJournalModal";
import JournalFooter from "@/components/journal/JournalFooter";

type TradeType = 1 | 2;
type Status = "in_progress" | "win" | "loss" | "break_even";
type Side = "buy" | "sell" | "long" | "short";

export type JournalRow = {
  id: string;
  asset_name: string;
  trade_type: TradeType;
  side: Side;
  status: Status;
  entry_price: number;
  exit_price: number | null;
  amount_spent: number;
  date: string | Date;
  strategy_id: string;
  pnl: number | null;
  leverage: number | null;
  trading_fee: number;
  timeframe_code: string;
  liquidation_price: number | null;
  stop_loss_price: number | null;
  strategy_rule_match: number;
  notes_entry: string | null;
  notes_review: string | null;
  tags?: string[];
};

type StrategyOption = { id: string; name: string | null };
type StrategyWithRules = StrategyOption & {
  rules: { id: string; title: string }[];
};

type JournalForm = {
  strategy_id: string;
  asset_name: string;
  trade_type: TradeType | string;
  trade_datetime: string;

  timeframe_number?: string;
  timeframe_unit?: "S" | "M" | "H" | "D" | "W" | "Y";

  trading_fee?: string;
  amount_spent?: string;
  entry_price?: string;
  exit_price?: string;
  stop_loss_price?: string;
  leverage?: string;
  liquidation_price?: string;

  side?: Side;
  status?: Status;

  matched_rule_ids?: string[];
  notes_entry?: string;
  notes_review?: string;

  tags?: string[];
};

type AssetOption = { id: string; symbol: string; name: string };
type JournalSummary = { id: string; name: string; created_at: string };
type Tag = {
  id: string;
  name: string;
};
type JournalsPayload = {
  items?: JournalSummary[];
  activeJournalId?: string | null;
};
type Rule = { id: string; title: string };
type HasRules = { rules?: Rule[] | undefined };
type HasStrategyRules = {
  strategy_rules?: Array<{ rule?: Rule | null | undefined }> | undefined;
};
type MaybeWithRules =
  | HasRules
  | HasStrategyRules
  | StrategyWithRules
  | undefined;

type JournalApiItem = Omit<JournalRow, "trading_fee"> & {
  trading_fee?: number | null;
  buy_fee?: number | null;
  sell_fee?: number | null;
  tags?: string[];
};

type JournalIndexResponse = { items: JournalApiItem[] };

function hasRules(x: unknown): x is HasRules {
  return (
    typeof x === "object" && x !== null && Array.isArray((x as HasRules).rules)
  );
}
function hasStrategyRules(x: unknown): x is HasStrategyRules {
  return (
    typeof x === "object" &&
    x !== null &&
    Array.isArray((x as HasStrategyRules).strategy_rules)
  );
}

function toLocalInputValue(dt: string | Date) {
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function toISO(dtLocal: string): string {
  return new Date(dtLocal).toISOString();
}

const fmt4 = (n: number | null | undefined) => {
  if (n == null) return "—";
  const s = String(n);
  const [i, d = ""] = s.split(".");
  const d4 = d.slice(0, 4);
  const trimmed = d4.replace(/0+$/, "");
  return trimmed ? `${i}.${trimmed}` : i;
};

function parseDecimal(input: string | number | null | undefined): number {
  if (input == null) return NaN;
  let s = String(input).trim().replace(/\s/g, "");
  if (!s) return NaN;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";

    s = s.replace(new RegExp("\\" + thousandSep, "g"), "");
    s = s.replace(new RegExp("\\" + decimalSep, "g"), ".");
  } else if (hasComma) {
    s = s.replace(/,/g, "");
  } else if (hasDot) {
  }
  return /^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s) ? Number(s) : NaN;
}


function decimalOrZero(input: string | number | null | undefined): number {
  const n = parseDecimal(input ?? "");
  return isNaN(n) ? 0 : n;
}

function toNum(input: string | number | null | undefined): number {
  return parseDecimal(input ?? "");
}

const money2 = (n: number) => `$${n.toFixed(3)}`;

type BasePayload = {
  strategy_id: string;
  asset_name: string;
  trade_datetime: string;
  side: Side;
  status: Status;
  amount_spent: number;
  entry_price: number;
  exit_price: number | null;
  stop_loss_price: number | null;
  strategy_rule_match: number;
  notes_entry: string | null;
  notes_review: string | null;
  timeframe_code: string;
  trading_fee: number;
  tags?: string[];
};

type CreateSpotPayload = BasePayload & { trade_type: 1 };
type CreateFuturesPayload = BasePayload & {
  trade_type: 2;
  futures: { leverage: number; liquidation_price: number | null };
};
type CreatePayload = CreateSpotPayload | CreateFuturesPayload;

export default function JournalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<JournalRow[]>([]);
  const [strategies, setStrategies] = useState<StrategyWithRules[]>([]);

  const [start, setStart] = useState<string>(() => {
    const end = new Date();
    const s = new Date(new Date().setMonth(end.getMonth() - 6));
    s.setHours(0, 0, 0, 0);
    return s.toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState<string>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString().slice(0, 10);
  });

  const [movedOutBanner, setMovedOutBanner] = useState<string | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "az" | "za">("new");
  const [showFilter, setShowFilter] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [assetQuery, setAssetQuery] = useState<string>("");
  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([]);
  const [showAssetMenu, setShowAssetMenu] = useState<boolean>(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const validSymbolsRef = useRef<Set<string>>(new Set());
  const assetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");

  const {
    register,
    control,
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
      trading_fee: "0",
      matched_rule_ids: [],
      notes_entry: "",
      notes_review: "",
      tags: [],
    },
    mode: "onTouched",
  });

  const wTradeType = Number(watch("trade_type") ?? 1) as TradeType;
  const wStatus = watch("status") as Status | undefined;
  const wStrategyId = watch("strategy_id");
  const wTags = watch("tags") ?? [];

  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [activeJournalName, setActiveJournalName] = useState<string>("");

  const searchParams = useSearchParams();
  const [handledFromPortfolio, setHandledFromPortfolio] = useState(false);

  const [firstRunOpen, setFirstRunOpen] = useState(false);
  const [firstRunName, setFirstRunName] = useState("");
  const [firstRunSaving, setFirstRunSaving] = useState(false);
  const [firstRunError, setFirstRunError] = useState<string | null>(null);

  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [rowToClose, setRowToClose] = useState<JournalRow | null>(null);
  const [closeExit, setCloseExit] = useState<string>("");
  const [closeTradingFee, setCloseTradingFee] = useState<string>("0");
  const [closePnl, setClosePnl] = useState<number | null>(null);
  const [closeExitError, setCloseExitError] = useState<string | null>(null);
  const [closeFeeError, setCloseFeeError] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const RULE_CACHE_PREFIX = "jrnl.ruleIds.";
  const makeRuleKey = (entryId: string) => `${RULE_CACHE_PREFIX}${entryId}`;
  function saveRuleIds(entryId: string, ids: string[]) {
    try {
      localStorage.setItem(makeRuleKey(entryId), JSON.stringify(ids));
    } catch {}
  }
  function loadRuleIds(entryId: string): string[] | null {
    try {
      const raw = localStorage.getItem(makeRuleKey(entryId));
      return raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      return null;
    }
  }
  function clearRuleIds(entryId: string) {
    try {
      localStorage.removeItem(makeRuleKey(entryId));
    } catch {}
  }

  async function loadTagsList() {
    try {
      setTagsLoading(true);
      setTagsError(null);

      const r = await fetch("/api/tags", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());

      const data = (await r.json()) as { items?: Tag[] } | Tag[];
      const list = Array.isArray(data) ? data : data.items ?? [];

      setAvailableTags(list);
    } catch {
      setTagsError("Could not load tags");
      setAvailableTags([]);
    } finally {
      setTagsLoading(false);
    }
  }

  useEffect(() => {
    register("tags");
  }, [register]);

    useEffect(() => {
    if (!open) return;
    void loadTagsList();
  }, [open]);

useEffect(() => {
  if (typeof window === "undefined") return;
  if (loading) return;

  if (journals.length === 0) {
    setFirstRunName("");
    setFirstRunOpen(true);
    return;
  }

  setFirstRunOpen(false);
}, [loading, journals.length]);


  useEffect(() => {
    const cur = watch("side") as Side | undefined;
    if (wTradeType === 1) {
      if (cur !== "buy" && cur !== "sell")
        setValue("side", "buy", { shouldValidate: true });
    } else {
      if (cur !== "long" && cur !== "short")
        setValue("side", "long", { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wTradeType]);

  function openCloseModal(r: JournalRow) {
    if (r.status !== "in_progress") return;
    setRowToClose(r);
    setCloseExit(r.exit_price != null ? String(r.exit_price) : "");
    setCloseTradingFee(String(r.trading_fee ?? ""));
    setClosePnl(null);
    setCloseExitError(null);
    setCloseFeeError(null);
    setCloseOpen(true);
  }

  useEffect(() => {
    if (!rowToClose) return;
    const exit = parseDecimal(closeExit);
    if (isNaN(exit)) {
      setClosePnl(null);
      return;
    }

    const tradingFeeNum = decimalOrZero(closeTradingFee);
    const dir =
      rowToClose.side === "buy" || rowToClose.side === "long" ? 1 : -1;
    const change = (exit - rowToClose.entry_price) / rowToClose.entry_price;
    const notional =
      rowToClose.trade_type === 2
        ? rowToClose.amount_spent * Math.max(1, rowToClose.leverage ?? 1)
        : rowToClose.amount_spent;
    const gross = dir * notional * change;
    const net = gross - tradingFeeNum;
    setClosePnl(Number(net.toFixed(2)));
  }, [closeExit, closeTradingFee, rowToClose]);

  function buildRangeQS(start: string, end: string) {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T23:59:59.999`);
    return new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    }).toString();
  }

  function resetToLast6Months() {
    const now = new Date();
    const s = new Date(new Date().setMonth(now.getMonth() - 6));
    s.setHours(0, 0, 0, 0);

    const startYMD = s.toISOString().slice(0, 10);
    const endYMD = now.toISOString().slice(0, 10);

    setStart(startYMD);
    setEnd(endYMD);

    try {
      localStorage.removeItem("jrnl.range");
    } catch {}

    void load();
  }

  function normalizeJournal(it: JournalApiItem): JournalRow {
    const unifiedFee =
      (it.trading_fee ?? null) != null
        ? Number(it.trading_fee)
        : Number(it.buy_fee ?? 0) + Number(it.sell_fee ?? 0);

    return {
      id: it.id,
      asset_name: it.asset_name,
      trade_type: it.trade_type,
      side: it.side,
      status: it.status,
      entry_price: Number(it.entry_price),
      exit_price: it.exit_price == null ? null : Number(it.exit_price),
      amount_spent: Number(it.amount_spent),
      date: it.date,
      strategy_id: it.strategy_id,
      pnl: it.pnl == null ? null : Number(it.pnl),
      leverage: it.leverage == null ? null : Number(it.leverage),
      timeframe_code: it.timeframe_code,
      liquidation_price:
        it.liquidation_price == null ? null : Number(it.liquidation_price),
      stop_loss_price:
        it.stop_loss_price == null ? null : Number(it.stop_loss_price),
      strategy_rule_match: Number(it.strategy_rule_match ?? 0),
      notes_entry: it.notes_entry,
      notes_review: it.notes_review,
      trading_fee: Number(unifiedFee) || 0,
      tags: it.tags ?? [],
    };
  }

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setMovedOutBanner(null);

      const qs = buildRangeQS(start, end);
      const [jr, st, jn] = await Promise.all([
        fetch(`/api/journal?${qs}`, { cache: "no-store" }),
        fetch(`/api/strategies`, { cache: "no-store" }),
        fetch(`/api/journals`, { cache: "no-store" }),
      ]);

      if (!jr.ok) throw new Error(await jr.text());
      if (!st.ok) throw new Error(await st.text());

      const j: JournalIndexResponse = await jr.json();
      setItems((j.items ?? []).map(normalizeJournal));

      const sPayload:
        | {
            items?: Array<{
              id: string;
              name: string | null;
              strategy_rules?: Array<{ rule: { id: string; title: string } }>;
            }>;
          }
        | Array<{ id: string; name: string | null }> = await st.json();

      const arr: StrategyWithRules[] = Array.isArray(sPayload)
        ? sPayload.map((x) => {
            const prev = strategiesRef.current.find((s) => s.id === x.id);
            return { id: x.id, name: x.name, rules: prev?.rules ?? [] };
          })
        : (sPayload.items ?? []).map((x) => ({
            id: x.id,
            name: x.name,
            rules: (x.strategy_rules ?? []).map((sr) => ({
              id: sr.rule.id,
              title: sr.rule.title,
            })),
          }));
      setStrategies(arr);

      if (!jn.ok) throw new Error(await jn.text());
      const jnPayload = (await jn.json()) as JournalsPayload;
      const list = jnPayload.items ?? [];
      setJournals(list);

      const name =
        list.find((x) => x.id === (jnPayload.activeJournalId ?? ""))?.name ??
        "";
      setActiveJournalName(name);

      return (j.items ?? []).map(normalizeJournal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load journal");
      return [];
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  const wTfNum = watch("timeframe_number");
  const wTfUnit = watch("timeframe_unit");

  useEffect(() => {
    try {
      if (
        wTfNum &&
        /^\d+$/.test(String(wTfNum)) &&
        ["S", "M", "H", "D", "W", "Y"].includes(String(wTfUnit))
      ) {
        localStorage.setItem(
          "jrnl.lastTf",
          JSON.stringify({ num: String(wTfNum), unit: String(wTfUnit) })
        );
      }
    } catch {}
  }, [wTfNum, wTfUnit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (handledFromPortfolio) return;
    if (!searchParams) return;
    if (loading) return;

    const from = searchParams.get("from");
    const openModal = searchParams.get("open_spot_trade_modal") === "1";
    if (from !== "portfolio" || !openModal) return;

    const assetName = searchParams.get("asset_name")?.toUpperCase() ?? "";

    if (assetName) {
      const candidates = items
        .filter(
          (r) => r.trade_type === 1 && r.asset_name.toUpperCase() === assetName
        )
        .sort((a, b) => +new Date(b.date) - +new Date(a.date));

      if (candidates.length > 0) {
        openEdit(candidates[0]);
        setHandledFromPortfolio(true);
        return;
      }

      openCreate();
      setValue("trade_type", 1, { shouldDirty: false });
      setValue("asset_name", assetName, { shouldDirty: true });
      setHandledFromPortfolio(true);
      return;
    }

    openCreate();
    setValue("trade_type", 1, { shouldDirty: false });
    setHandledFromPortfolio(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, items, handledFromPortfolio, setValue]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("jrnl.range") || "{}");
      if (saved.start) setStart(saved.start);
      if (saved.end) setEnd(saved.end);
    } catch {}
  }, []);

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
      tags: [],
    });

    setValue("side", "buy", { shouldValidate: false, shouldDirty: false });

    let lastTfNum = "4";
    let lastTfUnit: JournalForm["timeframe_unit"] = "H";
    try {
      const saved = JSON.parse(localStorage.getItem("jrnl.lastTf") || "{}");
      if (
        saved &&
        /^\d+$/.test(saved.num) &&
        ["S", "M", "H", "D", "W", "Y"].includes(saved.unit)
      ) {
        lastTfNum = saved.num;
        lastTfUnit = saved.unit;
      }
    } catch {}

    setValue("timeframe_number", lastTfNum, {
      shouldValidate: false,
      shouldDirty: false,
    });
    setValue("timeframe_unit", lastTfUnit, {
      shouldValidate: false,
      shouldDirty: false,
    });
    setValue("trading_fee", "0", { shouldValidate: false, shouldDirty: false });

    setOpen(true);
  }

  function openEdit(row: JournalRow) {
    setMode("edit");
    setEditingId(row.id);
    setWizardStep(1);

    validSymbolsRef.current = new Set([row.asset_name.toUpperCase()]);
    setAssetQuery(row.asset_name);
    setAssetOptions([]);
    setShowAssetMenu(false);

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
      stop_loss_price:
        row.stop_loss_price != null ? String(row.stop_loss_price) : "",
      leverage: row.leverage != null ? String(row.leverage) : "",
      liquidation_price:
        row.liquidation_price != null ? String(row.liquidation_price) : "",
      matched_rule_ids: [],
      notes_entry: row.notes_entry ?? "",
      notes_review: row.notes_review ?? "",
      tags: row.tags ?? [],
    });
    const tf = row.timeframe_code || "";
    const tfNum = tf.replace(/[A-Z]$/i, "");
    const tfUnit = tf.slice(-1).toUpperCase() as
      | "S"
      | "M"
      | "H"
      | "D"
      | "W"
      | "Y";
    setValue("timeframe_number", tfNum || "1", { shouldValidate: false });
    setValue(
      "timeframe_unit",
      (["S", "M", "H", "D", "W", "Y"].includes(tfUnit)
        ? tfUnit
        : "H") as JournalForm["timeframe_unit"],
      { shouldValidate: false }
    );
    setValue("trading_fee", String(row.trading_fee ?? 0), {
      shouldValidate: false,
      shouldDirty: false,
    });
    setValue("strategy_id", row.strategy_id, {
      shouldValidate: false,
      shouldDirty: false,
    });

    const rulesForStrategy = normalizeRules(
      strategiesRef.current.find((s) => s.id === row.strategy_id)
    );
    setStrategyRules(rulesForStrategy);

    const cached = loadRuleIds(row.id);
    const validIds = new Set(rulesForStrategy.map((r) => r.id));
    const cachedFiltered = Array.isArray(cached)
      ? cached.filter((id) => validIds.has(id))
      : [];

    if (cachedFiltered.length) {
      setValue("matched_rule_ids", cachedFiltered, { shouldDirty: false });
    } else {
      const prechecked = rulesForStrategy
        .slice(0, row.strategy_rule_match || 0)
        .map((r) => r.id);
      setValue("matched_rule_ids", prechecked, { shouldDirty: false });
    }

    if (!rulesForStrategy.length) {
      (async () => {
        try {
          const r = await fetch(`/api/strategies/${row.strategy_id}`, {
            cache: "no-store",
          });
          if (!r.ok) return;
          const data: unknown = await r.json();
          const normalized = normalizeRules(data as MaybeWithRules);
          setStrategyRules(normalized);

          const valid2 = new Set(normalized.map((rr) => rr.id));
          const cached2 = loadRuleIds(row.id);
          const cached2Filtered = Array.isArray(cached2)
            ? cached2.filter((id) => valid2.has(id))
            : [];
          if (cached2Filtered.length) {
            setValue("matched_rule_ids", cached2Filtered, {
              shouldDirty: false,
            });
          } else {
            const pre = normalized
              .slice(0, row.strategy_rule_match || 0)
              .map((rr) => rr.id);
            setValue("matched_rule_ids", pre, { shouldDirty: false });
          }
        } catch {}
      })();
    }

    setOpen(true);
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
    clearRuleIds(deleteId);
  }

  async function validateAndNext() {
    if (wizardStep === 1) {
      const ok = await trigger([
        "strategy_id",
        "asset_name",
        "trade_type",
        "trade_datetime",
      ]);
      if (ok) setWizardStep(2);
      return;
    }
    if (wizardStep === 2) {
      if (wTradeType === 1) {
        const ok = await trigger([
          "status",
          "amount_spent",
          "entry_price",
          "trading_fee",
        ]);
        if (ok) setWizardStep(3);
      } else {
        const ok = await trigger([
          "amount_spent",
          "entry_price",
          "leverage",
          "trading_fee",
          "status",
          "side",
        ]);
        if (ok) setWizardStep(3);
      }
      return;
    }
  }

  async function submitFinal(form: JournalForm) {
    const tradeType = Number(form.trade_type) as TradeType;
    const ruleCount = (form.matched_rule_ids ?? []).length;

    let coercedSide: Side = (form.side ?? "buy") as Side;
    coercedSide =
      tradeType === 1
        ? coercedSide === "sell"
          ? "sell"
          : "buy"
        : coercedSide === "short"
          ? "short"
          : "long";

    const timeframe_code =
      `${(form.timeframe_number ?? "").trim()}${form.timeframe_unit ?? ""}`.toUpperCase();

    const amt = toNum(form.amount_spent);
    const entry = toNum(form.entry_price);
    const fee = toNum(form.trading_fee ?? "0");
    const exit =
      form.exit_price && form.exit_price.trim() ? toNum(form.exit_price) : null;
    const sl =
      form.stop_loss_price && form.stop_loss_price.trim()
        ? toNum(form.stop_loss_price)
        : null;

    if (!(amt > 0) || !(entry > 0) || !(fee >= 0)) {
      alert("Please enter valid numbers (you can use commas).");
      return;
    }

    const base: BasePayload = {
      strategy_id: form.strategy_id,
      asset_name: form.asset_name,
      trade_datetime: toISO(form.trade_datetime),
      side: coercedSide,
      status: (form.status ?? "in_progress") as Status,
      amount_spent: amt,
      entry_price: entry,
      exit_price: exit,
      stop_loss_price: sl,
      strategy_rule_match: ruleCount,
      notes_entry: form.notes_entry?.trim() || null,
      notes_review: form.notes_review?.trim() || null,
      timeframe_code,
      trading_fee: fee,
      tags: (form.tags ?? []).map((t) => t.trim()).filter(Boolean),
    };

    let payload: CreatePayload;

    if (tradeType === 2) {
      const levParsed = parseDecimal(form.leverage ?? "");
      if (!(levParsed > 0)) {
        alert("Leverage must be > 0");
        return;
      }

      const liqParsed =
        form.liquidation_price && form.liquidation_price.trim()
          ? parseDecimal(form.liquidation_price)
          : NaN;
      const liq = isNaN(liqParsed) ? null : liqParsed;

      const futures: CreateFuturesPayload["futures"] = {
        leverage: levParsed,
        liquidation_price: liq,
      };

      payload = { ...base, trade_type: 2, futures };
    } else {
      payload = { ...base, trade_type: 1 };
    }

    const url =
      mode === "create" ? "/api/journal" : `/api/journal/${editingId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());

    if (method === "PUT" && editingId) {
      type PutReturn = {
        id: string;
        status: Status;
        exit_price: number | null;
        trading_fee: number;
      };
      const saved: PutReturn = await r.json();

      setItems((prev) =>
        prev.map((it) =>
          it.id === editingId
            ? {
                ...it,
                status: saved.status ?? it.status,
                exit_price: saved.exit_price ?? it.exit_price,
                trading_fee:
                  typeof saved.trading_fee === "number"
                    ? saved.trading_fee
                    : it.trading_fee,
              }
            : it
        )
      );
    } else {
      await r.json().catch(() => undefined);
    }

    const savedYMD = (form.trade_datetime || "").slice(0, 10);

    if (savedYMD < start || savedYMD > end) {
      setStart(savedYMD);
      setEnd(savedYMD);
      await load();
    } else {
      await load();
    }

    setMovedOutBanner(null);
  }

  const onSubmit = async (form: JournalForm) => {
    try {
      await submitFinal(form);
      if (mode === "edit" && editingId) {
        saveRuleIds(editingId, form.matched_rule_ids ?? []);
      }
      setOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save");
    }
  };

const STABLE_SUFFIXES = ["USDT", "USDC", "BUSD", "TUSD", "DAI", "USD"] as const;

function isPureAssetSymbol(symbolRaw: string) {
  const s = (symbolRaw ?? "").trim().toUpperCase();

  if (!s) return false;
  if (s.includes("/") || s.includes("-") || s.includes("_")) return false;

  for (const suf of STABLE_SUFFIXES) {
    if (s.length > suf.length && s.endsWith(suf)) return false;
  }

  if (!/^[A-Z0-9]{2,15}$/.test(s)) return false;

  return true;
}

async function fetchAssets(q: string) {
  try {
    setAssetError(null);

    const cleaned = q.trim();
    if (cleaned.length < 1) {
      setAssetOptions([]);
      setShowAssetMenu(false);
      validSymbolsRef.current = new Set();
      return;
    }

    const r = await fetch(`/api/assets/coins?q=${encodeURIComponent(cleaned)}`);
    if (!r.ok) throw new Error("Lookup failed");

    const data = (await r.json()) as { items: AssetOption[] };
    const all = data.items ?? [];

    const filtered = all.filter((i) => isPureAssetSymbol(i.symbol));

    setAssetOptions(filtered);
    validSymbolsRef.current = new Set(filtered.map((i) => i.symbol.toUpperCase()));
    setShowAssetMenu(filtered.length > 0);
  } catch {
    setAssetError("Could not load assets");
    setAssetOptions([]);
    setShowAssetMenu(false);
    validSymbolsRef.current = new Set();
  }
}

  const totalTrades = rows.length;
  const finished = rows.filter((r) => r.status !== "in_progress");
  const winRate = finished.length
    ? Math.round(
        (finished.filter((i) => i.status === "win").length * 100) /
          finished.length
      )
    : 0;

  const earnings = rows.reduce((acc, r) => acc + (r.pnl ?? 0), 0);

  const [strategyRules, setStrategyRules] = useState<Rule[]>([]);

  const strategiesRef = useRef<StrategyWithRules[]>([]);
  useEffect(() => {
    strategiesRef.current = strategies;
  }, [strategies]);

  function normalizeRules(payload: MaybeWithRules): Rule[] {
    if (!payload) return [];

    if (hasRules(payload) && payload.rules) {
      return payload.rules.map((r) => ({ id: r.id, title: r.title }));
    }

    if (hasStrategyRules(payload) && payload.strategy_rules) {
      return payload.strategy_rules
        .map((sr) => sr.rule)
        .filter((r): r is Rule => !!r)
        .map((r) => ({ id: r.id, title: r.title }));
    }

    return [];
  }

  useEffect(() => {
    let abort = false;
    async function loadRules() {
      if (!wStrategyId) return;

      const fromList = normalizeRules(
        strategiesRef.current.find((s) => s.id === wStrategyId)
      );
      if (fromList.length) {
        if (!abort) setStrategyRules(fromList);
      }

      try {
        const r = await fetch(`/api/strategies/${wStrategyId}`, {
          cache: "no-store",
        });
        if (!r.ok) throw new Error(await r.text());
        const data: unknown = await r.json();
        const normalized = normalizeRules(data as MaybeWithRules);
        if (!abort) setStrategyRules(normalized);
      } catch {
        if (!abort) setStrategyRules(fromList ?? []);
      }
    }
    void loadRules();
    return () => {
      abort = true;
    };
  }, [wStrategyId, open]);

  function renderStatusButton(r: JournalRow) {
    if (r.status === "in_progress") {
      return (
        <button
          title="Close Trade"
          onClick={() => openCloseModal(r)}
          className="px-2 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700"
        >
          Close Trade
        </button>
      );
    }

    const label = r.status.replace(/_/g, " ");
    const formatted =
      label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();

    let bg = "bg-green-500";
    let hover = "hover:bg-green-700";
    let text = "text-white";

    if (r.status === "loss") {
      bg = "bg-orange-600";
      hover = "hover:bg-orange-700";
    } else if (r.status === "break_even") {
      bg = "bg-gray-200";
      hover = "hover:bg-gray-300";
      text = "text-gray-700";
    }

    return (
      <button
        title={formatted}
        onClick={() => {}}
        className={`px-2 py-1 rounded ${bg} ${text} text-xs ${hover}`}
      >
        {formatted}
      </button>
    );
  }

  function toggleRow(id: string) {
    setExpandedRowId((prev) => (prev === id ? null : id));
  }

  async function handleQuickClose() {
    if (!rowToClose) return;
    setCloseExitError(null);
    setCloseFeeError(null);

    const exitNum = parseDecimal(closeExit);
    if (!(exitNum > 0)) {
      setCloseExitError("Exit price is required");
      return;
    }

    const tradingFeeNum = decimalOrZero(closeTradingFee);
    if (!(tradingFeeNum >= 0)) {
      setCloseFeeError("Trading fee must be ≥ 0");
      return;
    }

    try {
      setClosing(true);
      const longLike = rowToClose.side === "buy" || rowToClose.side === "long";
      const change = (exitNum - rowToClose.entry_price) / rowToClose.entry_price;
      const notional =
        rowToClose.trade_type === 2
          ? rowToClose.amount_spent * Math.max(1, rowToClose.leverage ?? 1)
          : rowToClose.amount_spent;

      const gross = (longLike ? 1 : -1) * notional * change;
      const net = gross - tradingFeeNum;
      const netRounded = Number(net.toFixed(2));

      const computedStatus: Status =
        Math.abs(netRounded) < 0.01
          ? "break_even"
          : netRounded > 0
            ? "win"
            : "loss";

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
        trading_fee: tradingFeeNum,
        tags: (rowToClose.tags ?? []).map((t) => t.trim()).filter(Boolean),
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
          : { ...baseClose, trade_type: 1 };

      const r = await fetch(`/api/journal/${rowToClose.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadClose),
      });
      const saved = await r.json();

      setItems((prev) =>
        prev.map((it) =>
          it.id === rowToClose.id
            ? {
                ...it,
                status: saved.status ?? it.status,
                exit_price: saved.exit_price ?? it.exit_price,
                trading_fee:
                  typeof saved.trading_fee === "number"
                    ? saved.trading_fee
                    : it.trading_fee,
              }
            : it
        )
      );
      setCloseOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to close");
    } finally {
      setClosing(false);
    }
  }

  async function saveFirstRunJournal() {
    if (!firstRunName.trim()) {
      setFirstRunError("Please enter a name.");
      return;
    }
    setFirstRunSaving(true);
    setFirstRunError(null);
    try {
      if (journals.length === 0) {
        const r = await fetch("/api/journals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: firstRunName.trim() }),
        });
        if (!r.ok) throw new Error(await r.text());
        const created = (await r.json()) as { id: string };

        await fetch("/api/journal/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: created.id }),
        });
      } else if (
        journals.length === 1 &&
        journals[0].name?.toLowerCase() === "main"
      ) {
        const r = await fetch(`/api/journals/${journals[0].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: firstRunName.trim() }),
        });
        if (!r.ok) throw new Error(await r.text());
      }

      await load();
      setFirstRunOpen(false);
    } catch (e) {
      setFirstRunError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setFirstRunSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <JournalToolbar
        activeJournalName={activeJournalName}
        movedOutBanner={movedOutBanner}
        onOpenExport={() => setExportOpen(true)}
        onOpenCreate={openCreate}
      />

      <JournalSummaryCards
        totalTrades={totalTrades}
        winRate={winRate}
        earnings={earnings}
      />

      <JournalDateRangeCard
        start={start}
        end={end}
        onStartChange={setStart}
        onEndChange={setEnd}
        onApply={() => {
          try {
            localStorage.setItem("jrnl.range", JSON.stringify({ start, end }));
          } catch {}
          void load();
        }}
        onReset={resetToLast6Months}
      />

      <JournalTradesCard
        loading={loading}
        error={error}
        rows={rows}
        showSearch={showSearch}
        query={query}
        showFilter={showFilter}
        showMenu={showMenu}
        expandedRowId={expandedRowId}
        onToggleSearch={() => setShowSearch((s) => !s)}
        onCloseSearch={() => setShowSearch(false)}
        onQueryChange={setQuery}
        onToggleFilter={() => {
          setShowFilter((f) => !f);
          setShowMenu(false);
        }}
        onCloseFilter={() => setShowFilter(false)}
        onToggleMenu={() => {
          setShowMenu((m) => !m);
          setShowFilter(false);
        }}
        onCloseMenu={() => setShowMenu(false)}
        onSortChange={setSort}
        onRefresh={() => {
          void load();
        }}
        onToggleRow={toggleRow}
        onOpenCloseModal={openCloseModal}
        onOpenEdit={openEdit}
        onAskDelete={askDelete}
        renderStatusButton={renderStatusButton}
        fmt4={fmt4}
        money2={money2}
      />

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
              <button
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              {wizardStep < 3 ? (
                <button
                  className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm hover:opacity-90"
                  onClick={() => void validateAndNext()}
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                  className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {mode === "create" ? "Add Trade" : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <form className="grid gap-4" onSubmit={() => {}}>
            {wizardStep === 1 && (
              <>
                <div>
                  <div className="text-sm mb-1">
                    Strategy Used <span className="text-red-600">*</span>
                  </div>
                  <select
                    {...register("strategy_id", {
                      required: "Strategy is required",
                    })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  >
                    <option value="">Select a strategy…</option>
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || "Untitled"}
                      </option>
                    ))}
                  </select>
                  {errors.strategy_id && (
                    <p className="mt-1 text-xs text-red-600">
                      {String(errors.strategy_id.message)}
                    </p>
                  )}
                </div>

                <div>
                  <div className="text-sm mb-1">
                    Asset <span className="text-red-600">*</span>
                  </div>
                  <input
                    {...register("asset_name", {
                      required: "Asset is required",
                      validate: (v) =>
                        validSymbolsRef.current.has((v ?? "").toUpperCase()) ||
                        "Pick an asset from the list",
                    })}
                    value={assetQuery}
                    onChange={(e) => {
                      const q = e.target.value;
                      setAssetQuery(q);
                      setValue("asset_name", q, { shouldValidate: true });
                      if (assetTimer.current) clearTimeout(assetTimer.current);
                      assetTimer.current = setTimeout(() => {
                        void fetchAssets(q);
                      }, 300);
                    }}
                    onFocus={() => {
                      if (assetOptions.length > 0) setShowAssetMenu(true);
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
                            setAssetQuery(opt.symbol);
                            setValue("asset_name", opt.symbol, {
                              shouldValidate: true,
                            });
                            validSymbolsRef.current = new Set([
                              opt.symbol.toUpperCase(),
                            ]);
                            setShowAssetMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        >
                          {opt.symbol} — {opt.name}
                        </button>
                      ))}
                      {assetOptions.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          No results
                        </div>
                      )}
                    </div>
                  )}
                  {assetError && (
                    <p className="mt-1 text-xs text-amber-700">{assetError}</p>
                  )}
                  {errors.asset_name && (
                    <p className="mt-1 text-xs text-red-600">
                      {String(errors.asset_name.message)}
                    </p>
                  )}
                </div>

                <div>
                  <div className="text-sm mb-1">
                    Trade Type <span className="text-red-600">*</span>
                  </div>
                  <select
                    {...register("trade_type", {
                      required: "Trade type is required",
                    })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  >
                    <option value={1}>Spot</option>
                    <option value={2}>Futures</option>
                  </select>
                  {errors.trade_type && (
                    <p className="mt-1 text-xs text-red-600">
                      {String(errors.trade_type.message)}
                    </p>
                  )}
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
                        const d = new Date(v);
                        const now = new Date();
                        return (
                          d.getTime() <= now.getTime() + 2 * 60 * 1000 ||
                          "Date/time cannot be in the future"
                        );
                      },
                    })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  />
                  {errors.trade_datetime && (
                    <p className="mt-1 text-xs text-red-600">
                      {String(errors.trade_datetime.message)}
                    </p>
                  )}
                </div>

                <div>
                  <div className="text-sm mb-1">
                    Timeframe <span className="text-red-600">*</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      {...register("timeframe_number", {
                        required: "Timeframe number is required",
                        validate: (v) =>
                          /^\d+$/.test(String(v ?? "")) || "Only digits",
                      })}
                      placeholder="e.g. 1"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2"
                    />
                    <select
                      {...register("timeframe_unit", {
                        required: "Unit is required",
                      })}
                      className="rounded-xl border border-gray-200 px-3 py-2"
                    >
                      {["S", "M", "H", "D", "W", "Y"].map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.timeframe_number && (
                    <p className="mt-1 text-xs text-red-600">
                      {String(errors.timeframe_number.message)}
                    </p>
                  )}
                  {errors.timeframe_unit && (
                    <p className="mt-1 text-xs text-red-600">
                      {String(errors.timeframe_unit.message)}
                    </p>
                  )}
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
                          {...register("status", {
                            required: "Status is required",
                          })}
                          onChange={(e) => {
                            const val = e.target.value as Status;
                            setValue("status", val, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
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
                          Trading Fee <span className="text-red-600">*</span>
                        </div>
                        <MoneyField<JournalForm>
                          name="trading_fee"
                          control={control}
                          placeholder="0"
                          decimalPlaces={3}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                          rules={{
                            required: "Trading fee is required",
                            validate: (v) =>
                              parseDecimal((v ?? "").toString() || "0") >= 0 ||
                              "Must be ≥ 0",
                          }}
                        />
                        {errors.trading_fee && (
                          <p className="mt-1 text-xs text-red-600">
                            {String(errors.trading_fee.message)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm mb-1">
                        Amount Spent <span className="text-red-600">*</span>
                      </div>
                      <MoneyField<JournalForm>
                        name="amount_spent"
                        control={control}
                        decimalPlaces={8}
                        placeholder="e.g. 500.00"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        rules={{
                          required: "Amount spent is required",
                          validate: (v) =>
                            parseDecimal((v ?? "").toString() || "0") > 0 ||
                            "Must be > 0",
                        }}
                      />
                      {errors.amount_spent && (
                        <p className="mt-1 text-xs text-red-600">
                          {String(errors.amount_spent.message)}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:col-span-full gap-4">
                      <div>
                        <div className="text-sm mb-1">
                          Entry Price <span className="text-red-600">*</span>
                        </div>
                        <MoneyField<JournalForm>
                          name="entry_price"
                          control={control}
                          decimalPlaces={8}
                          placeholder="e.g. 27654.32"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                          rules={{
                            required: "Entry price is required",
                            validate: (v) =>
                              parseDecimal((v ?? "").toString() || "0") > 0 ||
                              "Must be > 0",
                          }}
                        />
                        {errors.entry_price && (
                          <p className="mt-1 text-xs text-red-600">
                            {String(errors.entry_price.message)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm mb-1">Exit Price</div>
                      <MoneyField<JournalForm>
                        name="exit_price"
                        control={control}
                        decimalPlaces={8}
                        placeholder="e.g. 28000.00"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                      />
                    </div>

                    <div>
                      <div className="text-sm mb-1">Stop Loss Price</div>
                      <MoneyField<JournalForm>
                        name="stop_loss_price"
                        control={control}
                        decimalPlaces={8}
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
                      <MoneyField<JournalForm>
                        name="amount_spent"
                        control={control}
                        decimalPlaces={8}
                        placeholder="e.g. 1000.00"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        rules={{
                          required: "Amount spent is required",
                          validate: (v) =>
                            parseDecimal((v ?? "").toString() || "0") > 0 ||
                            "Must be > 0",
                        }}
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
                        <MoneyField<JournalForm>
                          name="entry_price"
                          control={control}
                          decimalPlaces={8}
                          placeholder="e.g. 27654.32"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                          rules={{
                            required: "Entry price is required",
                            validate: (v) =>
                              parseDecimal((v ?? "").toString() || "0") > 0 ||
                              "Must be > 0",
                          }}
                        />
                        {errors.entry_price && (
                          <p className="mt-1 text-xs text-red-600">
                            {String(errors.entry_price.message)}
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="text-sm mb-1">Exit Price</div>
                        <MoneyField<JournalForm>
                          name="exit_price"
                          control={control}
                          decimalPlaces={8}
                          placeholder="e.g. 28000.00"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        />
                      </div>
                      <div className="md:col-span-full">
                        <div className="text-sm mb-1">Stop Loss Price</div>
                        <MoneyField<JournalForm>
                          name="stop_loss_price"
                          control={control}
                          decimalPlaces={8}
                          placeholder="e.g. 25000.00"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-full">
                        <div className="text-sm mb-1">
                          Trading Fee <span className="text-red-600">*</span>
                        </div>
                        <MoneyField<JournalForm>
                          name="trading_fee"
                          control={control}
                          decimalPlaces={3}
                          placeholder="0"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                          rules={{
                            required: "Trading fee is required",
                            validate: (v) =>
                              parseDecimal((v ?? "").toString() || "0") >= 0 ||
                              "Must be ≥ 0",
                          }}
                        />
                        {errors.trading_fee && (
                          <p className="mt-1 text-xs text-red-600">
                            {String(errors.trading_fee.message)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm mb-1">
                          Leverage <span className="text-red-600">*</span>
                        </div>
                        <DecimalField<JournalForm>
                          name="leverage"
                          control={control}
                          placeholder="e.g. 10"
                          maxDecimals={2}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                          rules={{
                            required: "Leverage is required",
                            validate: (v) =>
                              parseDecimal((v ?? "").toString() || "0") > 0 ||
                              "Must be > 0",
                          }}
                        />
                        {errors.leverage && (
                          <p className="mt-1 text-xs text-red-600">
                            {String(errors.leverage.message)}
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="text-sm mb-1">Liquidation Price</div>
                        <MoneyField<JournalForm>
                          name="liquidation_price"
                          control={control}
                          decimalPlaces={3}
                          placeholder="e.g. 10000.32"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-sm mb-1">Status</div>
                      <select
                        {...register("status", {
                          required: "Status is required",
                        })}
                        onChange={(e) => {
                          const val = e.target.value as Status;
                          setValue("status", val, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                      >
                        <option value="in_progress">In Progress</option>
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="break_even">Break-Even</option>
                      </select>
                      {errors.status && (
                        <p className="mt-1 text-xs text-red-600">
                          {String(errors.status.message)}
                        </p>
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
                  <textarea
                    {...register("notes_entry")}
                    rows={3}
                    placeholder="Write any notes…"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  />
                </div>

                {(wStatus === "loss" || wStatus === "break_even") && (
                  <div>
                    <div className="text-sm mb-1">Post Loss Review (Optional)</div>
                    <textarea
                      {...register("notes_review")}
                      rows={3}
                      placeholder="Reflect on what went wrong…"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2"
                    />
                  </div>
                )}

                <hr className="my-2 border-gray-200" />

                <div>
                  <div className="text-sm mb-1">Tags (Optional)</div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const name = newTagName.trim();
                          if (!name) return;
                          if (wTags.includes(name)) {
                            setNewTagName("");
                            return;
                          }

                          try {
                            setTagsError(null);
                            const r = await fetch("/api/tags", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ name }),
                            });
                            if (!r.ok) throw new Error(await r.text());
                            const created = (await r.json()) as Tag;

                            setAvailableTags((prev) => {
                              if (prev.some((t) => t.id === created.id)) return prev;
                              return [...prev, created];
                            });

                            const updated = [...wTags, created.name];
                            setValue("tags", updated, {
                              shouldDirty: true,
                              shouldValidate: false,
                            });
                            setNewTagName("");
                          } catch {
                            setTagsError("Could not create tag");
                          }
                        }
                      }}
                      placeholder="Type a tag and press Enter…"
                      className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>

                  {tagsError && <p className="mt-1 text-xs text-red-600">{tagsError}</p>}

                  {wTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {wTags.map((t: string) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            const updated = wTags.filter((x: string) => x !== t);
                            setValue("tags", updated, {
                              shouldDirty: true,
                              shouldValidate: false,
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
                        >
                          <span>{t}</span>
                          <span className="text-gray-500">✕</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1">
                      Existing tags
                      {tagsLoading && " (loading…)"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.length === 0 && !tagsLoading && (
                        <span className="text-xs text-gray-400">No tags yet. Create one above.</span>
                      )}
                      {availableTags
                        .filter((t) => !wTags.includes(t.name))
                        .map((tag) => (
                          <button
                            type="button"
                            key={tag.id}
                            onClick={() => {
                              const updated = [...wTags, tag.name];
                              setValue("tags", updated, {
                                shouldDirty: true,
                                shouldValidate: false,
                              });
                            }}
                            className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs hover:bg-gray-50"
                          >
                            {tag.name}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </form>
        </div>
      </Modal>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />

      <DeleteEntryModal
        open={confirmOpen}
        deleting={deleting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
      />

      <QuickCloseModal
        open={closeOpen}
        closing={closing}
        rowToClose={rowToClose}
        closeExit={closeExit}
        closeTradingFee={closeTradingFee}
        closePnl={closePnl}
        closeExitError={closeExitError}
        closeFeeError={closeFeeError}
        onClose={() => setCloseOpen(false)}
        onSubmit={() => {
          void handleQuickClose();
        }}
        onCloseExitChange={(v) => {
          setCloseExit(v);
          setCloseExitError(null);
        }}
        onCloseTradingFeeChange={(v) => {
          setCloseTradingFee(v);
          setCloseFeeError(null);
        }}
        fmt4={fmt4}
        money2={money2}
      />

      <FirstRunJournalModal
        open={firstRunOpen}
        firstRunName={firstRunName}
        firstRunSaving={firstRunSaving}
        firstRunError={firstRunError}
        onClose={() => setFirstRunOpen(false)}
        onNameChange={setFirstRunName}
        onSave={() => {
          void saveFirstRunJournal();
        }}
      />

      <JournalFooter />
    </div>
  );
}
