"use client";

import React, {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import Modal from "@/components/ui/Modal";
import { MoneyField } from "@/components/form/MaskedFields";
import JournalToolbar from "@/components/journal/JournalToolbar";
import JournalSummaryCards from "@/components/journal/JournalSummaryCards";
import JournalTradesCard from "@/components/journal/JournalTradesCard";
import ExportModal from "@/components/journal/ExportModal";
import DeleteEntryModal from "@/components/journal/DeleteEntryModal";
import QuickCloseModal from "@/components/journal/QuickCloseModal";
import FirstRunJournalModal from "@/components/journal/FirstRunJournalModal";
import JournalFooter from "@/components/journal/JournalFooter";
import ManageJournalsModal from "@/components/journal/ManageJournalsModal";

type TradeType = 1 | 2;
type Status = "in_progress" | "win" | "loss" | "break_even";
type Side = "buy" | "sell" | "long" | "short";
type StatusFilter = "all" | "open" | "win" | "loss";
type DirectionFilter = "all" | "long" | "short";

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
  closed_at: string | Date | null;
  strategy_id: string;
  pnl: number | null;
  trading_fee: number;
  stop_loss_price: number | null;
  strategy_rule_match: number;
  notes_entry: string | null;
  notes_review: string | null;
  tags?: string[];
};

type JournalForm = {
  asset_name: string;
  trade_type: TradeType | string;
  trade_datetime: string;
  closed_datetime?: string;

  trading_fee?: string;
  amount_spent?: string;
  amount?: string;
  entry_price?: string;
  exit_price?: string;
  stop_loss_price?: string;

  side?: Side;
  status?: Status;

  notes_entry?: string;
  notes_review?: string;

  tags?: string[];
};

type AssetOption = { id: string; symbol: string; name: string };
type JournalSummary = { id: string; name: string; created_at: string };
type Tag = {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
};
type JournalsPayload = {
  items?: JournalSummary[];
  activeJournalId?: string | null;
};
type JournalApiItem = Omit<JournalRow, "trading_fee"> & {
  trading_fee?: number | null;
  buy_fee?: number | null;
  sell_fee?: number | null;
  closed_at?: string | null;
  tags?: string[];
};

type JournalIndexResponse = { items: JournalApiItem[] };

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
  asset_name: string;
  trade_datetime: string;
  closed_at: string | null;
  side: Side;
  status: Status;
  amount_spent: number;
  entry_price: number;
  exit_price: number | null;
  stop_loss_price: number | null;
  strategy_rule_match: number;
  notes_entry: string | null;
  notes_review: string | null;
  trading_fee: number;
  tags?: string[];
};

type CreateSpotPayload = BasePayload & { trade_type: 1 };
type CreateFuturesPayload = BasePayload & { trade_type: 2 };
type CreatePayload = CreateSpotPayload | CreateFuturesPayload;

function JournalsPageContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<JournalRow[]>([]);

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

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [assetFilter, setAssetFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addNotes, setAddNotes] = useState(false);
  const [setTargets, setSetTargets] = useState(false);

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
  const [newTagColor, setNewTagColor] = useState("#7C3AED");
  const [showNewTagForm, setShowNewTagForm] = useState(false);

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
      asset_name: "",
      trade_type: 1,
      trade_datetime: toLocalInputValue(new Date()),
      closed_datetime: "",
      trading_fee: "0",
      notes_entry: "",
      notes_review: "",
      tags: [],
    },
    mode: "onTouched",
  });

  const wTradeType = Number(watch("trade_type") ?? 1) as TradeType;
  const wStatus = watch("status") as Status | undefined;
  const wTags = watch("tags") ?? [];
  const wAmountSpent = watch("amount_spent");
  const wAmount = watch("amount");
  const wEntryPrice = watch("entry_price");
  const amountSyncRef = useRef<"amount_spent" | "amount" | null>(null);

  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [activeJournalId, setActiveJournalId] = useState<string | null>(null);
  const [activeJournalName, setActiveJournalName] = useState<string>("");
  const [manageJournalsOpen, setManageJournalsOpen] = useState(false);
  const [pendingJournalAction, setPendingJournalAction] = useState<string | null>(
    null,
  );
  const [manageJournalsError, setManageJournalsError] = useState<string | null>(
    null,
  );

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

  function clearRuleIds(entryId: string) {
    try {
      localStorage.removeItem(`jrnl.ruleIds.${entryId}`);
    } catch {}
  }

  async function loadTagsList() {
    try {
      setTagsLoading(true);
      setTagsError(null);

      const r = await fetch("/api/tags", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());

      const data = (await r.json()) as { items?: Tag[] } | Tag[];
      const list = Array.isArray(data) ? data : (data.items ?? []);

      setAvailableTags(list);
    } catch {
      setTagsError("Could not load tags");
      setAvailableTags([]);
    } finally {
      setTagsLoading(false);
    }
  }

  async function createPendingTag() {
    const name = newTagName.trim();
    if (!name) return null;

    if (!wTags.includes(name) && wTags.length >= 10) {
      setTagsError("You can select up to 10 tags");
      return null;
    }

    if (wTags.includes(name)) {
      setNewTagName("");
      return name;
    }

    try {
      setTagsError(null);
      const r = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newTagColor }),
      });
      if (!r.ok) throw new Error(await r.text());
      const created = (await r.json()) as Tag;

      setAvailableTags((prev) => {
        if (prev.some((t) => t.id === created.id)) return prev;
        return [...prev, created];
      });

      const updated = Array.from(new Set([...wTags, created.name]));
      setValue("tags", updated, {
        shouldDirty: true,
        shouldValidate: false,
      });
      setNewTagName("");
      setNewTagColor("#7C3AED");
      setShowNewTagForm(false);
      return created.name;
    } catch {
      setTagsError("Could not create tag");
      return null;
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
    void loadTagsList();
  }, []);

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

  useEffect(() => {
    const entry = parseDecimal(wEntryPrice ?? "");
    if (!(entry > 0)) return;

    if (amountSyncRef.current === "amount_spent") {
      const total = parseDecimal(wAmountSpent ?? "");
      const nextQty = total > 0 ? String(total / entry) : "";
      if ((wAmount ?? "") !== nextQty) {
        setValue("amount", nextQty, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    if (amountSyncRef.current === "amount") {
      const qty = parseDecimal(wAmount ?? "");
      const nextTotal = qty > 0 ? String(qty * entry) : "";
      if ((wAmountSpent ?? "") !== nextTotal) {
        setValue("amount_spent", nextTotal, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  }, [wAmountSpent, wAmount, wEntryPrice, setValue]);

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
    const notional = rowToClose.amount_spent;
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
      closed_at: it.closed_at ?? null,
      strategy_id: it.strategy_id,
      pnl: it.pnl == null ? null : Number(it.pnl),
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
      const [jr, jn] = await Promise.all([
        fetch(`/api/journal?${qs}`, { cache: "no-store" }),
        fetch(`/api/journals`, { cache: "no-store" }),
      ]);

      if (!jr.ok) throw new Error(await jr.text());

      const j: JournalIndexResponse = await jr.json();
      setItems((j.items ?? []).map(normalizeJournal));

      if (!jn.ok) throw new Error(await jn.text());
      const jnPayload = (await jn.json()) as JournalsPayload;
      const list = jnPayload.items ?? [];
      setJournals(list);
      setActiveJournalId(jnPayload.activeJournalId ?? null);

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
          (r) => r.trade_type === 1 && r.asset_name.toUpperCase() === assetName,
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
        `${i.asset_name} ${i.status} ${i.side} ${(i.tags ?? []).join(" ")} ${i.notes_entry ?? ""} ${i.notes_review ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    if (assetFilter !== "all") {
      arr = arr.filter((i) => i.asset_name.toUpperCase() === assetFilter);
    }
    if (directionFilter !== "all") {
      arr = arr.filter((i) => {
        const longLike = i.side === "buy" || i.side === "long";
        return directionFilter === "long" ? longLike : !longLike;
      });
    }
    if (statusFilter !== "all") {
      arr = arr.filter((i) => {
        if (statusFilter === "open") return i.status === "in_progress";
        return i.status === statusFilter;
      });
    }
    return [...arr].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [items, query, assetFilter, directionFilter, statusFilter]);

  function updateDateRange(next: { start?: string; end?: string }) {
    const nextStart = next.start ?? start;
    const nextEnd = next.end ?? end;

    setStart(nextStart);
    setEnd(nextEnd);

    try {
      localStorage.setItem(
        "jrnl.range",
        JSON.stringify({ start: nextStart, end: nextEnd }),
      );
    } catch {}
  }

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setWizardStep(1);
    setAddNotes(false);
    setSetTargets(false);
    setShowNewTagForm(false);

    validSymbolsRef.current = new Set();
    setAssetQuery("");
    setAssetOptions([]);
    setShowAssetMenu(false);

    reset({
      asset_name: "",
      trade_type: 1,
      trade_datetime: toLocalInputValue(new Date()),
      closed_datetime: "",
      amount: "",
      notes_entry: "",
      notes_review: "",
      tags: [],
    });

    setValue("side", "buy", { shouldValidate: false, shouldDirty: false });
    setValue("trading_fee", "0", { shouldValidate: false, shouldDirty: false });
    amountSyncRef.current = null;

    setOpen(true);
  }

  function openEdit(row: JournalRow) {
    setMode("edit");
    setEditingId(row.id);
    setWizardStep(1);
    setAddNotes(Boolean(row.notes_entry || row.notes_review));
    setSetTargets(Boolean(row.exit_price || row.stop_loss_price));
    setShowNewTagForm(false);

    validSymbolsRef.current = new Set([row.asset_name.toUpperCase()]);
    setAssetQuery(row.asset_name);
    setAssetOptions([]);
    setShowAssetMenu(false);

    reset({
      asset_name: row.asset_name,
      trade_type: row.trade_type,
      trade_datetime: toLocalInputValue(row.date),
      closed_datetime: row.closed_at ? toLocalInputValue(row.closed_at) : "",
      side: row.side,
      status: row.status,
      amount_spent: String(row.amount_spent),
      amount:
        row.entry_price > 0 ? String(row.amount_spent / row.entry_price) : "",
      entry_price: String(row.entry_price),
      exit_price: row.exit_price != null ? String(row.exit_price) : "",
      stop_loss_price:
        row.stop_loss_price != null ? String(row.stop_loss_price) : "",
      notes_entry: row.notes_entry ?? "",
      notes_review: row.notes_review ?? "",
      tags: row.tags ?? [],
    });
    setValue("trading_fee", String(row.trading_fee ?? 0), {
      shouldValidate: false,
      shouldDirty: false,
    });
    amountSyncRef.current = "amount_spent";

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
        if (ok) await handleSubmit(onSubmit)();
      } else {
        const ok = await trigger([
          "amount_spent",
          "entry_price",
          "trading_fee",
          "status",
          "side",
        ]);
        if (ok) await handleSubmit(onSubmit)();
      }
      return;
    }
  }

  async function submitFinal(form: JournalForm) {
    const tradeType = Number(form.trade_type) as TradeType;
    const ruleCount = 0;

    let coercedSide: Side = (form.side ?? "buy") as Side;
    coercedSide =
      tradeType === 1
        ? coercedSide === "sell"
          ? "sell"
          : "buy"
        : coercedSide === "short"
          ? "short"
          : "long";

    const entry = toNum(form.entry_price);
    const qty = toNum(form.amount);
    const amtRaw = toNum(form.amount_spent);
    const amt = amtRaw > 0 ? amtRaw : entry > 0 && qty > 0 ? qty * entry : NaN;
    const fee = toNum(form.trading_fee ?? "0");
    const exit =
      setTargets && form.exit_price && form.exit_price.trim()
        ? toNum(form.exit_price)
        : null;
    const sl =
      setTargets && form.stop_loss_price && form.stop_loss_price.trim()
        ? toNum(form.stop_loss_price)
        : null;
    const status = (form.status ?? "in_progress") as Status;
    const closedAt =
      status === "in_progress"
        ? null
        : form.closed_datetime?.trim()
          ? toISO(form.closed_datetime)
          : new Date().toISOString();

    if (!(amt > 0) || !(entry > 0) || !(fee >= 0)) {
      alert("Please enter valid numbers (you can use commas).");
      return;
    }

    const pendingTagName = newTagName.trim();
    const pendingTagToInclude =
      pendingTagName && !(form.tags ?? []).includes(pendingTagName)
        ? await createPendingTag()
        : pendingTagName;

    if (pendingTagName && !pendingTagToInclude) {
      return;
    }

    const tagNames = Array.from(
      new Set(
        [
          ...(form.tags ?? []),
          ...(pendingTagToInclude ? [pendingTagToInclude] : []),
        ]
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    );

    const base: BasePayload = {
      asset_name: form.asset_name,
      trade_datetime: toISO(form.trade_datetime),
      closed_at: closedAt,
      side: coercedSide,
      status,
      amount_spent: amt,
      entry_price: entry,
      exit_price: exit,
      stop_loss_price: sl,
      strategy_rule_match: ruleCount,
      notes_entry: addNotes ? form.notes_entry?.trim() || null : null,
      notes_review: addNotes ? form.notes_review?.trim() || null : null,
      trading_fee: fee,
      tags: tagNames,
    };

    let payload: CreatePayload;

    if (tradeType === 2) {
      payload = { ...base, trade_type: 2 };
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
    if (!r.ok) {
      const body = await r.text();
      let msg = body;
      try {
        const parsed = JSON.parse(body) as { error?: unknown };
        if (typeof parsed.error === "string" && parsed.error.trim()) {
          msg = parsed.error;
        }
      } catch {}
      throw new Error(msg || `Failed to save trade (${r.status})`);
    }

    if (method === "PUT" && editingId) {
      type PutReturn = {
        id: string;
        status: Status;
        exit_price: number | null;
        trading_fee: number;
        closed_at: string | null;
      };
      const saved: PutReturn = await r.json();

      setItems((prev) =>
        prev.map((it) =>
          it.id === editingId
            ? {
                ...it,
                status: saved.status ?? it.status,
                exit_price: saved.exit_price ?? it.exit_price,
                closed_at:
                  typeof saved.closed_at === "string" || saved.closed_at === null
                    ? saved.closed_at
                    : it.closed_at,
                trading_fee:
                  typeof saved.trading_fee === "number"
                    ? saved.trading_fee
                    : it.trading_fee,
              }
            : it,
        ),
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
      setOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const STABLE_SUFFIXES = [
    "USDT",
    "USDC",
    "BUSD",
    "TUSD",
    "DAI",
    "USD",
  ] as const;

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

      const r = await fetch(
        `/api/assets/coins?q=${encodeURIComponent(cleaned)}`,
      );
      if (!r.ok) throw new Error("Lookup failed");

      const data = (await r.json()) as { items: AssetOption[] };
      const all = data.items ?? [];

      const filtered = all.filter((i) => isPureAssetSymbol(i.symbol));

      setAssetOptions(filtered);
      validSymbolsRef.current = new Set(
        filtered.map((i) => i.symbol.toUpperCase()),
      );
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
          finished.length,
      )
    : 0;

  const earnings = rows.reduce((acc, r) => acc + (r.pnl ?? 0), 0);
  const grossProfit = finished.reduce(
    (acc, r) => acc + Math.max(r.pnl ?? 0, 0),
    0,
  );
  const grossLoss = Math.abs(
    finished.reduce((acc, r) => acc + Math.min(r.pnl ?? 0, 0), 0),
  );
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;
  const openTrades = rows.filter((r) => r.status === "in_progress").length;
  const averagePositionSize = rows.length
    ? rows.reduce((acc, r) => acc + r.amount_spent, 0) / rows.length
    : 0;
  const assets = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.asset_name.toUpperCase())))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [items],
  );

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
      const change =
        (exitNum - rowToClose.entry_price) / rowToClose.entry_price;
      const notional = rowToClose.amount_spent;

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
        asset_name: rowToClose.asset_name,
        trade_datetime: toISO(toLocalInputValue(rowToClose.date)),
        closed_at: new Date().toISOString(),
        side: rowToClose.side,
        status: computedStatus,
        amount_spent: rowToClose.amount_spent,
        entry_price: rowToClose.entry_price,
        exit_price: exitNum,
        stop_loss_price: rowToClose.stop_loss_price ?? null,
        strategy_rule_match: rowToClose.strategy_rule_match ?? 0,
        notes_entry: rowToClose.notes_entry ?? null,
        notes_review: rowToClose.notes_review ?? null,
        trading_fee: tradingFeeNum,
        tags: (rowToClose.tags ?? []).map((t) => t.trim()).filter(Boolean),
      };

      const payloadClose: CreatePayload =
        rowToClose.trade_type === 2
          ? { ...baseClose, trade_type: 2 }
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
                closed_at:
                  typeof saved.closed_at === "string" || saved.closed_at === null
                    ? saved.closed_at
                    : it.closed_at,
                trading_fee:
                  typeof saved.trading_fee === "number"
                    ? saved.trading_fee
                    : it.trading_fee,
              }
            : it,
        ),
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

  async function switchActiveJournal(id: string) {
    setPendingJournalAction(`select:${id}`);
    setManageJournalsError(null);
    try {
      const r = await fetch("/api/journal/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error(await r.text());

      await load();
      setManageJournalsOpen(false);
    } catch (e) {
      setManageJournalsError(
        e instanceof Error ? e.message : "Failed to switch journal",
      );
    } finally {
      setPendingJournalAction(null);
    }
  }

  async function createJournal(name: string) {
    setPendingJournalAction("create");
    setManageJournalsError(null);
    try {
      const r = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error(await r.text());
      const created = (await r.json()) as { id: string };

      await switchActiveJournal(created.id);
    } catch (e) {
      setManageJournalsError(
        e instanceof Error ? e.message : "Failed to create journal",
      );
    } finally {
      setPendingJournalAction(null);
    }
  }

  async function renameJournal(id: string, name: string) {
    setPendingJournalAction(`rename:${id}`);
    setManageJournalsError(null);
    try {
      const r = await fetch(`/api/journals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error(await r.text());

      await load();
    } catch (e) {
      setManageJournalsError(
        e instanceof Error ? e.message : "Failed to rename journal",
      );
    } finally {
      setPendingJournalAction(null);
    }
  }

  async function deleteJournal(id: string) {
    setPendingJournalAction(`delete:${id}`);
    setManageJournalsError(null);
    try {
      const r = await fetch(`/api/journals/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());

      await load();
    } catch (e) {
      setManageJournalsError(
        e instanceof Error ? e.message : "Failed to delete journal",
      );
    } finally {
      setPendingJournalAction(null);
    }
  }

  function renderTagsSection() {
    return (
      <div>
        <div className="text-sm mb-1">Tags (Optional)</div>
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="max-h-44 min-h-24 flex-1 overflow-y-auto rounded-xl border border-gray-200 p-2">
            {availableTags.map((tag) => {
              const checked = wTags.includes(tag.name);
              const disabled = !checked && wTags.length >= 10;

              return (
                <label
                  key={tag.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 ${
                    disabled ? "opacity-50" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (wTags.length >= 10) {
                          setTagsError("You can select up to 10 tags");
                          return;
                        }
                        setTagsError(null);
                        setValue("tags", [...wTags, tag.name], {
                          shouldDirty: true,
                        });
                      } else {
                        setTagsError(null);
                        setValue(
                          "tags",
                          wTags.filter((name: string) => name !== tag.name),
                          { shouldDirty: true },
                        );
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color ?? "#9CA3AF" }}
                  />
                  <span>{tag.name}</span>
                </label>
              );
            })}
            {availableTags.length === 0 && !tagsLoading && (
              <p className="px-2 py-1 text-xs text-gray-400">
                No tags yet. Add a new tag.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowNewTagForm((open) => !open)}
            className="h-10 rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
          >
            Add New Tag
          </button>
        </div>

        {showNewTagForm && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-gray-200 p-3 sm:flex-row">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void createPendingTag();
                }
              }}
              placeholder="New tag name"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="h-10 w-12 rounded-xl border border-gray-200 bg-white p-1"
              title="Tag color"
            />
            <button
              type="button"
              onClick={() => void createPendingTag()}
              className="rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Save Tag
            </button>
          </div>
        )}

        {tagsError && <p className="mt-1 text-xs text-red-600">{tagsError}</p>}
        <p className="mt-1 text-xs text-gray-500">{wTags.length}/10 selected</p>
        {wTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {wTags.map((t: string) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  const updated = wTags.filter((x: string) => x !== t);
                  setValue("tags", updated, { shouldDirty: true });
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      availableTags.find((tag) => tag.name === t)?.color ??
                      "#9CA3AF",
                  }}
                />
                <span>{t}</span>
                <span className="text-gray-500">x</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <JournalToolbar
        activeJournalName={activeJournalName}
        movedOutBanner={movedOutBanner}
        onOpenManageJournals={() => setManageJournalsOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onOpenCreate={openCreate}
      />

      <JournalSummaryCards
        totalTrades={totalTrades}
        winRate={winRate}
        earnings={earnings}
        profitFactor={profitFactor}
        openTrades={openTrades}
        averagePositionSize={averagePositionSize}
      />

      <JournalTradesCard
        loading={loading}
        error={error}
        rows={rows}
        query={query}
        start={start}
        end={end}
        availableTags={availableTags}
        statusFilter={statusFilter}
        directionFilter={directionFilter}
        assetFilter={assetFilter}
        assets={assets}
        expandedRowId={expandedRowId}
        onQueryChange={setQuery}
        onStartChange={(value) => updateDateRange({ start: value })}
        onEndChange={(value) => updateDateRange({ end: value })}
        onStatusFilterChange={setStatusFilter}
        onDirectionFilterChange={setDirectionFilter}
        onAssetFilterChange={setAssetFilter}
        onRefresh={() => {
          void load();
        }}
        onToggleRow={toggleRow}
        onOpenCloseModal={openCloseModal}
        onOpenEdit={openEdit}
        onAskDelete={askDelete}
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
                  onClick={() => setWizardStep(1)}
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
              {wizardStep < 2 ? (
                <button
                  className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm hover:opacity-90"
                  onClick={() => void validateAndNext()}
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={() => void validateAndNext()}
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
                <hr className="my-2 border-gray-200" />
                {renderTagsSection()}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm mb-1">Quantity</div>
                        <MoneyField<JournalForm>
                          name="amount"
                          control={control}
                          decimalPlaces={8}
                          placeholder="e.g. 0.018"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                          onFocus={() => {
                            amountSyncRef.current = "amount";
                          }}
                        />
                      </div>
                      <div>
                        <div className="text-sm mb-1">
                          Total (USD) <span className="text-red-600">*</span>
                        </div>
                        <MoneyField<JournalForm>
                          name="amount_spent"
                          control={control}
                          decimalPlaces={8}
                          placeholder="e.g. 500.00"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                          onFocus={() => {
                            amountSyncRef.current = "amount_spent";
                          }}
                          rules={{
                            required: "Total is required",
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
                    </div>

                    <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={setTargets}
                        onChange={(e) => setSetTargets(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Set Profit & Loss Targets
                    </label>

                    {setTargets && (
                      <>
                        <div>
                          <div className="text-sm mb-1">Take Profit Price</div>
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
                    )}
                  </>
                ) : (
                  <>
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
                    </div>

                    <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={setTargets}
                        onChange={(e) => setSetTargets(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Set Profit & Loss Targets
                    </label>

                    {setTargets && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm mb-1">Take Profit Price</div>
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
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm mb-1">Quantity</div>
                        <MoneyField<JournalForm>
                          name="amount"
                          control={control}
                          decimalPlaces={8}
                          placeholder="e.g. 0.018"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                          onFocus={() => {
                            amountSyncRef.current = "amount";
                          }}
                        />
                      </div>
                      <div>
                        <div className="text-sm mb-1">
                          Total (USD) <span className="text-red-600">*</span>
                        </div>
                        <MoneyField<JournalForm>
                          name="amount_spent"
                          control={control}
                          decimalPlaces={8}
                          placeholder="e.g. 1000.00"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                          onFocus={() => {
                            amountSyncRef.current = "amount_spent";
                          }}
                          rules={{
                            required: "Total is required",
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

                {wStatus && wStatus !== "in_progress" && (
                  <div>
                    <div className="text-sm mb-1">
                      Date & Time Closed
                    </div>
                    <input
                      type="datetime-local"
                      {...register("closed_datetime")}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={addNotes}
                    onChange={(e) => setAddNotes(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Add Notes
                </label>

                {addNotes && (
                  <div className="grid gap-4">
                    <div>
                      <div className="text-sm mb-1">Notes (Optional)</div>
                      <textarea
                        {...register("notes_entry")}
                        rows={3}
                        placeholder="Write any notes..."
                        className="w-full rounded-xl border border-gray-200 px-3 py-2"
                      />
                    </div>

                    {(wStatus === "loss" || wStatus === "break_even") && (
                      <div>
                        <div className="text-sm mb-1">
                          Post Loss Review (Optional)
                        </div>
                        <textarea
                          {...register("notes_review")}
                          rows={3}
                          placeholder="Reflect on what went wrong..."
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </form>
        </div>
      </Modal>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />

      <ManageJournalsModal
        open={manageJournalsOpen}
        journals={journals}
        activeJournalId={activeJournalId}
        pendingAction={pendingJournalAction}
        error={manageJournalsError}
        onClose={() => setManageJournalsOpen(false)}
        onSelect={(id) => {
          void switchActiveJournal(id);
        }}
        onCreate={(name) => {
          void createJournal(name);
        }}
        onRename={(id, name) => {
          void renameJournal(id, name);
        }}
        onDelete={(id) => {
          void deleteJournal(id);
        }}
      />

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

export default function JournalPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Loading journals...
        </div>
      }
    >
      <JournalsPageContent />
    </Suspense>
  );
}
