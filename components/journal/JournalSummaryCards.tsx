import React from "react";

type JournalSummaryCardsProps = {
  totalTrades: number;
  winRate: number;
  earnings: number;
  profitFactor: number | null;
  openTrades: number;
  averagePositionSize: number;
};

export default function JournalSummaryCards({
  totalTrades,
  winRate,
  earnings,
  profitFactor,
  openTrades,
  averagePositionSize,
}: JournalSummaryCardsProps) {
  const earningsLabel = `${earnings >= 0 ? "+" : "-"}$${Math.abs(earnings).toFixed(2)}`;
  const averagePositionLabel = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(averagePositionSize);
  const profitFactorLabel =
    profitFactor == null || !Number.isFinite(profitFactor)
      ? "-"
      : profitFactor.toFixed(2);
  const profitHealth =
    profitFactor == null
      ? "No closed losses"
      : profitFactor < 1.2
        ? "Dangerous"
        : profitFactor < 1.6
          ? "Acceptable"
          : "Optimal";

  return (
    <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
      <MetricCard
        label="Net P&L"
        value={earningsLabel}
        helper="Total PnL of this journal"
        tone="green"
        iconPath="M4 17 10 11l4 4 6-8M15 7h5v5"
        valueClassName={earnings >= 0 ? "text-[#11895a]" : "text-[#d83a52]"}
      />
      <MetricCard
        label="Win rate"
        value={`${winRate}%`}
        helper={`${totalTrades - openTrades} closed trades`}
        foot={`${openTrades} open`}
        tone="indigo"
        iconPath="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-3.5-8 2.3 2.3L16 9"
      />
      <MetricCard
        label="Profit factor"
        value={profitFactorLabel}
        helper="Gross profit ÷ gross loss"
        foot={profitHealth}
        tone="blue"
        iconPath="M4 18V9M10 18V5M16 18v-7M22 18H2"
      />
      <MetricCard
        label="Total trades"
        value={String(totalTrades)}
        helper={`Average size $${averagePositionLabel}`}
        foot={`${openTrades} open`}
        tone="amber"
        iconPath="M4 7h16M7 4v6M17 4v6M5 12h14v8H5z"
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  foot,
  tone,
  iconPath,
  valueClassName = "text-[#152033]",
}: {
  label: string;
  value: string;
  helper: string;
  foot?: string;
  tone: "green" | "indigo" | "blue" | "amber";
  iconPath: string;
  valueClassName?: string;
}) {
  const tones = {
    green: "bg-[#eaf8f1] text-[#11895a]",
    indigo: "bg-[#eef2ff] text-[#4f46e5]",
    blue: "bg-[#eaf5ff] text-[#1479c9]",
    amber: "bg-[#fff7e6] text-[#b76e00]",
  };

  return (
    <article className="relative flex min-h-36 flex-col justify-between overflow-hidden rounded-2xl border border-[#e3e8f0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_rgba(16,24,40,.05)]">
      <div className="absolute -right-5 -top-6 h-24 w-24 rounded-full border border-[#edf0f5] bg-[#f8fafc]" />
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="text-[13px] font-semibold text-[#667085]">{label}</div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.9"
            viewBox="0 0 24 24"
          >
            <path d={iconPath} />
          </svg>
        </div>
      </div>
      <div className={`relative z-10 mt-3 text-3xl font-bold tracking-tight ${valueClassName}`}>
        {value}
      </div>
      <div className="relative z-10 mt-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-[#98a2b3]">{helper}</span>
        {foot && <span className="font-bold text-[#11895a]">{foot}</span>}
      </div>
    </article>
  );
}
