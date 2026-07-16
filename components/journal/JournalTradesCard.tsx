import React, { useRef } from "react";
import DropdownActions from "@/components/journals/DropdownActions";
import type { JournalRow } from "@/app/(app)/journal/journal-client";

type StatusFilter = "all" | "open" | "win" | "loss";
type DirectionFilter = "all" | "long" | "short";

type TagOption = {
  id: string;
  name: string;
  color?: string;
};

type JournalTradesCardProps = {
  loading: boolean;
  error: string | null;
  rows: JournalRow[];
  query: string;
  start: string;
  end: string;
  availableTags: TagOption[];
  statusFilter: StatusFilter;
  directionFilter: DirectionFilter;
  assetFilter: string;
  assets: string[];
  expandedRowId: string | null;
  onQueryChange: (value: string) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onDirectionFilterChange: (value: DirectionFilter) => void;
  onAssetFilterChange: (value: string) => void;
  onRefresh: () => void;
  onToggleRow: (id: string) => void;
  onOpenCloseModal: (row: JournalRow) => void;
  onOpenEdit: (row: JournalRow) => void;
  onAskDelete: (id: string) => void;
  fmt4: (n: number | null | undefined) => string;
  money2: (n: number) => string;
};

export default function JournalTradesCard({
  loading,
  error,
  rows,
  query,
  start,
  end,
  availableTags,
  statusFilter,
  directionFilter,
  assetFilter,
  assets,
  expandedRowId,
  onQueryChange,
  onStartChange,
  onEndChange,
  onStatusFilterChange,
  onDirectionFilterChange,
  onAssetFilterChange,
  onRefresh,
  onToggleRow,
  onOpenCloseModal,
  onOpenEdit,
  onAskDelete,
  fmt4,
  money2,
}: JournalTradesCardProps) {
  function tagColor(name: string) {
    return availableTags.find((tag) => tag.name === name)?.color ?? "#667085";
  }

  function renderTags(tags?: string[]) {
    const clean = (tags ?? []).filter(Boolean);
    if (!clean.length) {
      return (
        <span className="inline-flex min-h-6 items-center rounded-full bg-[#f2f4f7] px-2 text-[11px] font-semibold text-[#667085]">
          No setup tag
        </span>
      );
    }

    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {clean.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="inline-flex min-h-6 items-center gap-1.5 rounded-full bg-[#f2f4f7] px-2 text-[11px] font-semibold text-[#475467]"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: tagColor(tag) }}
            />
            {tag}
          </span>
        ))}
        {clean.length > 3 && (
          <span className="inline-flex min-h-6 items-center rounded-full border border-[#d4dbe6] bg-white px-2 text-[11px] font-bold text-[#4f46e5]">
            +{clean.length - 3} more
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e3e8f0] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_rgba(16,24,40,.05)]">
        <label className="relative min-w-[280px] flex-[1_1_320px]">
          <span className="sr-only">Search trades</span>
          <svg aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search asset, setup, tag, or note..."
            type="search"
            className="h-[42px] w-full rounded-xl border border-[#d4dbe6] bg-white pl-10 pr-3 text-sm text-[#344054] outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#eef2ff]"
          />
        </label>

        <div className="flex min-h-[42px] items-center gap-2 whitespace-nowrap rounded-xl border border-[#d4dbe6] bg-white px-3 text-sm text-[#344054]">
          <svg aria-hidden="true" className="h-4 w-4 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect height="16" rx="2" width="18" x="3" y="5" />
            <path d="M16 3v4M8 3v4M3 10h18" />
          </svg>
          <DatePickerText
            label="Start date"
            value={start}
            onChange={onStartChange}
          />
          <span className="text-[#98a2b3]">-</span>
          <DatePickerText label="End date" value={end} onChange={onEndChange} />
        </div>

        <select
          aria-label="Asset filter"
          value={assetFilter}
          onChange={(e) => onAssetFilterChange(e.target.value)}
          className="h-[42px] rounded-xl border border-[#d4dbe6] bg-white px-3 text-sm font-medium text-[#344054] outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#eef2ff]"
        >
          <option value="all">All assets</option>
          {assets.map((asset) => (
            <option key={asset} value={asset}>
              {asset}
            </option>
          ))}
        </select>

        <select
          aria-label="Direction filter"
          value={directionFilter}
          onChange={(e) => onDirectionFilterChange(e.target.value as DirectionFilter)}
          className="h-[42px] rounded-xl border border-[#d4dbe6] bg-white px-3 text-sm font-medium text-[#344054] outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#eef2ff]"
        >
          <option value="all">Long & short</option>
          <option value="long">Long only</option>
          <option value="short">Short only</option>
        </select>

        <div className="flex-[1_1_auto]" />

        <div className="flex rounded-xl border border-[#e3e8f0] bg-[#f8fafc] p-1">
          {[
            ["all", "All"],
            ["open", "Open"],
            ["win", "Wins"],
            ["loss", "Losses"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onStatusFilterChange(value as StatusFilter)}
              className={`h-8 rounded-lg px-3 text-xs font-bold ${
                statusFilter === value
                  ? "bg-white text-[#152033] shadow-sm"
                  : "text-[#667085] hover:text-[#152033]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="journal-trades rounded-2xl border border-[#e3e8f0] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_rgba(16,24,40,.05)]">
      <div className="flex items-center justify-between gap-4 border-b border-[#e3e8f0] px-5 py-4">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[17px] font-bold text-[#152033]">
              Trade history
            </h2>
            <span className="text-xs text-[#667085]">
              {rows.length} {rows.length === 1 ? "trade" : "trades"}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#667085] md:hidden">
            Tap the chevron to view additional trade details.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="grid h-10 w-10 place-items-center rounded-xl border border-[#d4dbe6] bg-white text-[#667085] hover:bg-[#f8fafc]"
          aria-label="Refresh trades"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
            <path d="M3 21v-5h5" />
            <path d="M3 12A9 9 0 0 1 18.3 5.6L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-[#667085]">Loading...</div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-[#d83a52]">{error}</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#667085]">
          No trades match these filters.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] border-collapse text-sm">
              <thead>
                <tr>
                  <HeaderCell className="w-[150px]">Asset</HeaderCell>
                  <HeaderCell className="w-[92px]">Direction</HeaderCell>
                  <HeaderCell className="w-[300px]">Entry -&gt; Exit</HeaderCell>
                  <HeaderCell className="w-[138px]">Position size</HeaderCell>
                  <HeaderCell className="w-[92px]">P&amp;L</HeaderCell>
                  <HeaderCell className="w-[128px]">Opened</HeaderCell>
                  <HeaderCell className="min-w-[275px]">Setups / tags</HeaderCell>
                  <HeaderCell className="w-[138px] text-right">Status/actions</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const expanded = expandedRowId === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <TradeRow
                        row={row}
                        expanded={expanded}
                        renderTags={renderTags}
                        onToggleRow={onToggleRow}
                        onOpenCloseModal={onOpenCloseModal}
                        onOpenEdit={onOpenEdit}
                        onAskDelete={onAskDelete}
                        fmt4={fmt4}
                        money2={money2}
                      />
                      {expanded && (
                        <tr className="bg-[#fbfcff]">
                          <td colSpan={8} className="border-b border-[#edf0f4] px-14 pb-4">
                            <DetailCard row={row} fmt4={fmt4} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-4 text-xs text-[#667085]">
            <span>
              Showing 1-{rows.length} of {rows.length} trades
            </span>
            <div className="flex items-center gap-1.5">
              <button className="h-8 w-8 rounded-lg border border-[#e3e8f0] bg-white text-[#667085]" type="button">
                &lt;
              </button>
              <button className="h-8 w-8 rounded-lg border border-[#4f46e5] bg-[#4f46e5] text-white" type="button">
                1
              </button>
              <button className="h-8 w-8 rounded-lg border border-[#e3e8f0] bg-white text-[#667085]" type="button">
                &gt;
              </button>
            </div>
          </div>
        </>
      )}
      </section>
    </>
  );
}

function HeaderCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`border-b border-[#e3e8f0] bg-[#fbfcfe] px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-[.04em] text-[#667085] ${className}`}>
      {children}
    </th>
  );
}

function DatePickerText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.click();
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={openPicker}
        className="cursor-pointer bg-transparent p-0 text-left text-sm text-[#344054]"
      >
        {formatFilterDate(value)}
      </button>
      <input
        ref={inputRef}
        aria-label={label}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="journal-date-input absolute inset-0 h-full w-full cursor-pointer opacity-0"
        tabIndex={-1}
      />
    </span>
  );
}

function TradeRow({
  row,
  expanded,
  renderTags,
  onToggleRow,
  onOpenCloseModal,
  onOpenEdit,
  onAskDelete,
  fmt4,
  money2,
}: {
  row: JournalRow;
  expanded: boolean;
  renderTags: (tags?: string[]) => React.ReactNode;
  onToggleRow: (id: string) => void;
  onOpenCloseModal: (row: JournalRow) => void;
  onOpenEdit: (row: JournalRow) => void;
  onAskDelete: (id: string) => void;
  fmt4: (n: number | null | undefined) => string;
  money2: (n: number) => string;
}) {
  const quantity = row.entry_price > 0 ? row.amount_spent / row.entry_price : null;
  const estimate = estimateMove(row);
  const opened = formatOpened(row.date);

  return (
    <tr className={`transition hover:bg-[#fafbff] ${expanded ? "bg-[#fbfcff]" : ""}`}>
      <BodyCell dataLabel="Asset">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            aria-label="Toggle trade details"
            type="button"
            onClick={() => onToggleRow(row.id)}
            className="grid h-[26px] w-[26px] place-items-center rounded-lg text-[#667085] hover:bg-[#f8fafc]"
          >
            <svg
              aria-hidden="true"
              className={`h-4 w-4 transition ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
          <div className={`grid h-[34px] w-[34px] place-items-center rounded-xl text-xs font-extrabold ${assetTone(row.asset_name)}`}>
            {assetGlyph(row.asset_name)}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[#152033]">{row.asset_name}</div>
            <div className="mt-0.5 text-[11px] text-[#98a2b3]">
              {row.trade_type === 2 ? "Futures" : "Spot"}
            </div>
          </div>
        </div>
      </BodyCell>

      <BodyCell dataLabel="Direction">
        <DirectionPill side={row.side} />
      </BodyCell>

      <BodyCell dataLabel="Entry -> Exit">
        <div className="font-mono text-xs tabular-nums">
          <strong className="block font-bold text-[#152033]">
            ${fmt4(row.entry_price)} -&gt; {row.exit_price != null ? `$${fmt4(row.exit_price)}` : "-"}
          </strong>
          {estimate && (
            <span className={`mt-1 block font-bold ${estimate.pnl >= 0 ? "text-[#11895a]" : "text-[#d83a52]"}`}>
              Estimated PnL: {estimate.pnl >= 0 ? "+" : "-"}${Math.abs(estimate.pnl).toFixed(2)} ({estimate.percent >= 0 ? "+" : "-"}{Math.abs(estimate.percent).toFixed(2)}%)
            </span>
          )}
        </div>
      </BodyCell>

      <BodyCell dataLabel="Position size">
        <div className="font-mono tabular-nums">
          <strong className="block text-sm font-bold text-[#152033]">
            {money2(row.amount_spent)}
          </strong>
          <span className="mt-1 block text-[11px] font-semibold text-[#667085]">
            {quantity != null ? `${fmt4(quantity)} ${row.asset_name}` : "-"}
          </span>
        </div>
      </BodyCell>

      <BodyCell dataLabel="P&L">
        {row.pnl == null || row.status === "in_progress" ? (
          <div className="font-bold text-[#b76e00]">-</div>
        ) : (
          <div className={`font-mono font-bold tabular-nums ${row.pnl >= 0 ? "text-[#11895a]" : "text-[#d83a52]"}`}>
            {row.pnl >= 0 ? "+" : "-"}${Math.abs(row.pnl).toFixed(2)}
          </div>
        )}
      </BodyCell>

      <BodyCell dataLabel="Opened">
        <div>
          <strong className="block text-xs font-bold text-[#152033]">{opened.date}</strong>
          <span className="text-[11px] text-[#98a2b3]">{opened.time}</span>
        </div>
      </BodyCell>

      <BodyCell dataLabel="Setups / tags">{renderTags(row.tags)}</BodyCell>

      <BodyCell className="text-right" dataLabel="Status/actions">
        <div className="flex items-center justify-end gap-2.5">
          <StatusPill status={row.status} />
          <DropdownActions
            r={row}
            openEdit={onOpenEdit}
            askDelete={onAskDelete}
            onQuickClose={onOpenCloseModal}
          />
        </div>
      </BodyCell>
    </tr>
  );
}

function BodyCell({
  children,
  className = "",
  dataLabel,
}: {
  children: React.ReactNode;
  className?: string;
  dataLabel: string;
}) {
  return (
    <td
      data-label={dataLabel}
      className={`border-b border-[#edf0f4] px-3.5 py-3.5 align-middle text-[#344054] ${className}`}
    >
      {children}
    </td>
  );
}

function DetailCard({
  row,
  fmt4,
}: {
  row: JournalRow;
  fmt4: (n: number | null | undefined) => string;
}) {
  const note = row.notes_review || row.notes_entry || "-";

  return (
    <div className="grid gap-4 rounded-xl border border-[#e3e8f0] bg-white p-3.5 md:grid-cols-4">
      <DetailItem label="Stop loss" value={row.stop_loss_price != null ? `$${fmt4(row.stop_loss_price)}` : "-"} mono />
      <DetailItem label="Risk / reward" value={riskReward(row)} />
      <DetailItem label="Duration" value={tradeDuration(row)} />
      <DetailItem label="Note" value={note} />
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.04em] text-[#98a2b3]">
        {label}
      </span>
      <strong className={`text-xs font-bold text-[#344054] ${mono ? "font-mono" : ""}`}>
        {value}
      </strong>
    </div>
  );
}

function DirectionPill({ side }: { side: JournalRow["side"] }) {
  const short = side === "sell" || side === "short";
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold ${short ? "border-[#f5c9cf] bg-[#fff0f2] text-[#d83a52]" : "border-[#c9eadb] bg-[#eaf8f1] text-[#11895a]"}`}>
      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {short ? (
          <>
            <path d="M5 7h10v10" />
            <path d="m5 17 10-10" />
          </>
        ) : (
          <>
            <path d="M5 17h10V7" />
            <path d="m5 7 10 10" />
          </>
        )}
      </svg>
      {short ? "Short" : "Long"}
    </span>
  );
}

function StatusPill({ status }: { status: JournalRow["status"] }) {
  const config = {
    in_progress: ["Open", "bg-[#fff7e6] text-[#b76e00]"],
    win: ["Win", "bg-[#eaf8f1] text-[#11895a]"],
    loss: ["Loss", "bg-[#fff0f2] text-[#d83a52]"],
    break_even: ["Break even", "bg-[#f2f4f7] text-[#667085]"],
  } as const;
  const [label, className] = config[status];

  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function estimateMove(row: JournalRow) {
  if (row.exit_price == null || !(row.entry_price > 0)) return null;
  const longLike = row.side === "buy" || row.side === "long";
  const change = (row.exit_price - row.entry_price) / row.entry_price;
  const pnl = (longLike ? 1 : -1) * row.amount_spent * change;
  return { pnl, percent: (longLike ? 1 : -1) * change * 100 };
}

function tradeDuration(row: JournalRow) {
  if (row.exit_price == null || row.status === "in_progress") return "-";
  return "Closed trade";
}

function riskReward(row: JournalRow) {
  if (row.stop_loss_price == null || row.exit_price == null) return "-";
  const risk = Math.abs(row.entry_price - row.stop_loss_price);
  const reward = Math.abs(row.exit_price - row.entry_price);
  if (!(risk > 0) || !(reward > 0)) return "-";
  return `1 : ${(reward / risk).toFixed(1)}`;
}

function formatOpened(value: string | Date) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function formatFilterDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function assetGlyph(asset: string) {
  const normalized = asset.toUpperCase();
  if (normalized === "BTC") return "B";
  if (normalized === "ETH") return "E";
  return normalized.slice(0, 2);
}

function assetTone(asset: string) {
  const normalized = asset.toUpperCase();
  if (normalized === "BTC") return "bg-[#fff3df] text-[#b56200]";
  if (normalized === "ETH") return "bg-[#eef1ff] text-[#4f46e5]";
  return "bg-[#f2f4f7] text-[#475467]";
}
