"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, InfoIcon, SearchIcon } from "@/components/portfolio/icons";
import { CoinBadge } from "@/components/portfolio/CoinBadge";
import { cls, pct, qty, usd } from "@/components/portfolio/format";
import type { AssetRow } from "@/components/portfolio/AssetsTable";
import {
  buildChainAllocation,
  type ChainAllocationRow,
  type ChainInfo,
} from "@/components/portfolio/chain-utils";

type SortKey = "value" | "allocation" | "chain" | "assets";
type ChainSubtab = "allocation" | "insights";

function usd4(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(Number.isFinite(n) ? n : 0);
}

function assetValue(asset: AssetRow) {
  const value =
    Number.isFinite(asset.holdingsValueUsd) && asset.holdingsValueUsd > 0
      ? asset.holdingsValueUsd
      : asset.totalInvestedUsd;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function chainChangeUsd(chain: ChainAllocationRow) {
  return chain.assets.reduce((sum, asset) => {
    const value = assetValue(asset);
    const changePct = asset.change24hPct ?? 0;
    const divisor = 1 + changePct / 100;
    const previousValue = divisor > 0 ? value / divisor : value;
    return sum + (value - previousValue);
  }, 0);
}

function chainSortValue(row: ChainAllocationRow, sort: SortKey) {
  switch (sort) {
    case "chain":
      return row.chain.name;
    case "assets":
      return row.assets.length;
    case "allocation":
      return row.percent;
    case "value":
      return row.valueUsd;
  }
}

export default function ChainView({ assets }: { assets: AssetRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("value");
  const [openChainIds, setOpenChainIds] = useState<Set<string>>(() => new Set());
  const [subtab, setSubtab] = useState<ChainSubtab>("allocation");
  const [showInfoBanner, setShowInfoBanner] = useState(true);

  const chains = useMemo(() => buildChainAllocation(assets), [assets]);
  const filteredChains = useMemo(() => {
    const q = query.trim().toLowerCase();

    return chains
      .filter((chain) => {
        if (!q) return true;
        const haystack = [
          chain.chain.name,
          chain.chain.symbol,
          ...chain.assets.flatMap((asset) => [asset.symbol, asset.name ?? ""]),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const av = chainSortValue(a, sort);
        const bv = chainSortValue(b, sort);
        if (typeof av === "string" || typeof bv === "string") {
          return String(av).localeCompare(String(bv));
        }
        return bv - av;
      });
  }, [chains, query, sort]);

  const totalValue = chains.reduce((sum, chain) => sum + chain.valueUsd, 0);
  const topChain = chains[0] ?? null;
  const chain24hUsd = chains.reduce((sum, chain) => {
    const previousValue = chain.assets.reduce((assetSum, asset) => {
      const value = asset.holdingsValueUsd || asset.totalInvestedUsd;
      const changePct = asset.change24hPct ?? 0;
      const divisor = 1 + changePct / 100;
      return assetSum + (divisor > 0 ? value / divisor : value);
    }, 0);
    return sum + (chain.valueUsd - previousValue);
  }, 0);
  const chain24hPct =
    totalValue - chain24hUsd > 0
      ? (chain24hUsd / (totalValue - chain24hUsd)) * 100
      : 0;
  const topPerformer = [...chains].sort((a, b) => {
    const aRoi = a.investedUsd > 0 ? (a.profitUsd / a.investedUsd) * 100 : 0;
    const bRoi = b.investedUsd > 0 ? (b.profitUsd / b.investedUsd) * 100 : 0;
    return bRoi - aRoi;
  })[0] ?? null;
  const topPerformerRoi =
    topPerformer && topPerformer.investedUsd > 0
      ? (topPerformer.profitUsd / topPerformer.investedUsd) * 100
      : 0;
  const topChainColor = topChain?.chain.color ?? "#5848DF";
  const topPerformerColor = topPerformer?.chain.color ?? "#05AA7C";

  function toggleChain(id: string) {
    setOpenChainIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="min-w-0">
      <div className="mb-7 inline-flex rounded-[14px] border border-[#DFE5EF] bg-[#F4F6FA] p-1.5 shadow-[0_6px_18px_rgba(20,32,54,0.025)]">
        <button
          type="button"
          className={cls(
            "min-h-[44px] cursor-pointer rounded-[11px] px-6 text-sm font-extrabold",
            subtab === "allocation"
              ? "bg-white text-[#6D3EE8] shadow-[0_6px_18px_rgba(15,23,42,0.06)]"
              : "text-[#5E6A80]",
          )}
          onClick={() => setSubtab("allocation")}
        >
          Chain Allocation
        </button>
        <button
          type="button"
          className={cls(
            "min-h-[44px] cursor-pointer rounded-[11px] px-6 text-sm font-extrabold",
            subtab === "insights"
              ? "bg-white text-[#6D3EE8] shadow-[0_6px_18px_rgba(15,23,42,0.06)]"
              : "text-[#5E6A80]",
          )}
          onClick={() => setSubtab("insights")}
        >
          Chain Insights
        </button>
      </div>

      {subtab === "insights" ? null : (
        <>
      <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(390px,1.45fr)_minmax(260px,0.9fr)_minmax(280px,0.95fr)]">
        <SummaryCard
          label="Largest Chain Exposure"
          value={topChain ? `${topChain.chain.name} • ${usd(topChain.valueUsd)}` : "No Chain"}
          subtext={
            topChain
              ? `${pct(topChain.percent)} of portfolio value`
              : "Add assets to calculate chain exposure"
          }
          accentColor={topChainColor}
          icon={topChain ? <ChainMark chain={topChain.chain} /> : <ChainMark />}
          sparkline
        />
        <SummaryCard
          label="24h Chain P&L"
          value={usd(chain24hUsd)}
          subtext={pct(chain24hPct)}
          iconClass={cls(
            chain24hUsd >= 0
              ? "bg-[#EAFBF3] text-[#0BA36D]"
              : "bg-[#FFF0F1] text-[#EF2C37]",
          )}
          icon={<PnlIcon down={chain24hUsd < 0} />}
          valueClass={chain24hUsd >= 0 ? "text-[#0BA36D]" : "text-[#EF2C37]"}
          subtextClass={chain24hUsd >= 0 ? "text-[#0BA36D]" : "text-[#EF2C37]"}
        />
        <SummaryCard
          label="Top Performing Chain"
          value={topPerformer?.chain.name ?? "No Chain"}
          subtext={`Current ROI ${pct(topPerformerRoi)}`}
          accentColor={topPerformerColor}
          icon={topPerformer ? <ChainMark chain={topPerformer.chain} /> : <ChainMark />}
          valueColor={topPerformerColor}
          subtextColor={topPerformerColor}
        />
      </div>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#667085]" />
          <input
            className="h-[52px] w-full rounded-[13px] border border-[#DFE5EF] bg-white px-4 pl-12 text-sm font-medium text-[#34415A] outline-none shadow-[0_6px_18px_rgba(50,50,80,0.025)] focus:border-[#CBB5FF]"
            placeholder="Search chain or asset..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label className="relative block min-w-[205px]">
          <select
            className="h-[52px] w-full cursor-pointer appearance-none rounded-[13px] border border-[#DFE5EF] bg-white py-0 pl-4 pr-14 text-sm font-extrabold text-[#4C5B73] outline-none shadow-[0_6px_18px_rgba(50,50,80,0.025)]"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            <option value="value">Sort: Chain Value</option>
            <option value="allocation">Sort: Allocation</option>
            <option value="chain">Sort: Chain Name</option>
            <option value="assets">Sort: Asset Count</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4C5B73]" />
        </label>
      </div>

      {showInfoBanner ? (
        <div className="mb-5 flex min-h-[55px] items-center gap-3 rounded-[13px] border border-[#D8C6FF] bg-[#F8F2FF] px-4 py-3 text-xs font-medium text-[#6943C7]">
          <InfoIcon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <strong className="font-extrabold text-[#6638CF]">Chain View</strong>{" "}
            groups your current assets by the blockchain they run on.
          </span>
          <button
            type="button"
            aria-label="Dismiss chain grouping message"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-[#6F7A8F] transition hover:bg-white/70 hover:text-[#4C5B73]"
            onClick={() => setShowInfoBanner(false)}
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
      ) : null}

      <div className="grid gap-4">
        {filteredChains.length > 0 ? (
          filteredChains.map((chain) => (
            <ChainPanel
              key={chain.chain.id}
              chain={chain}
              isOpen={openChainIds.has(chain.chain.id)}
              onToggle={() => toggleChain(chain.chain.id)}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No chains match your search.
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
  icon,
  iconClass,
  accentColor,
  valueClass,
  subtextClass,
  valueColor,
  subtextColor,
  sparkline,
}: {
  label: string;
  value: string;
  subtext: string;
  icon: ReactNode;
  iconClass?: string;
  accentColor?: string;
  valueClass?: string;
  subtextClass?: string;
  valueColor?: string;
  subtextColor?: string;
  sparkline?: boolean;
}) {
  const accentStyle = accentColor
    ? { backgroundColor: `${accentColor}18`, color: accentColor }
    : undefined;

  return (
    <div className="relative min-h-[104px] overflow-hidden rounded-[12px] border border-[#E1E5EE] bg-white p-4 shadow-[0_2px_8px_rgba(37,47,75,0.018)]">
      <div className="text-left text-[11px] font-extrabold uppercase tracking-[0.075em] text-[#536078]">
        {label}
      </div>
      <div className="mt-3 flex min-h-[58px] items-center gap-3.5">
        <div
          className={cls(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full",
            iconClass,
          )}
          style={accentStyle}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div
            className={cls(
              "truncate text-[18px] font-extrabold leading-tight text-[#101828]",
              valueClass,
            )}
            style={valueColor ? { color: valueColor } : undefined}
          >
            {value}
          </div>
          <div
            className={cls("mt-1.5 text-xs font-medium text-[#7D8AA5]", subtextClass)}
            style={subtextColor ? { color: subtextColor } : undefined}
          >
            {subtext}
          </div>
        </div>
      </div>
      {sparkline ? <SummarySparkline color={accentColor ?? "#9D74FF"} /> : null}
    </div>
  );
}

function ChainPanel({
  chain,
  isOpen,
  onToggle,
}: {
  chain: ChainAllocationRow;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const changeUsd = chainChangeUsd(chain);
  const changeUp = (chain.change24hPct ?? 0) >= 0;

  return (
    <div className="overflow-hidden rounded-[17px] border border-[#E0E5EE] bg-white shadow-[0_5px_16px_rgba(48,45,78,0.025)]">
      <button
        type="button"
        className="grid min-h-[106px] w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left lg:grid-cols-[minmax(260px,1.55fr)_repeat(3,minmax(120px,0.72fr))_42px]"
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-4">
          <ChainBadge chain={chain.chain} />
          <div className="min-w-0">
            <strong className="block truncate text-base font-extrabold text-[#17213A]">
              {chain.chain.name}
            </strong>
            <small className="mt-1 block text-xs font-medium text-[#8A96AD]">
              {chain.assets.length} held{" "}
              {chain.assets.length === 1 ? "asset" : "assets"}
            </small>
          </div>
        </div>

        <Metric
          className="hidden lg:flex"
          label="Chain Value"
          value={usd(chain.valueUsd)}
          subtext={`${pct(chain.percent)} allocation`}
        />
        <Metric
          className="hidden lg:flex"
          label="24h Change"
          value={pct(chain.change24hPct)}
          subtext={usd(changeUsd)}
          valueClass={changeUp ? "text-emerald-600" : "text-red-600"}
        />
        <Metric
          className="hidden lg:flex"
          label="Assets"
          value={String(chain.assets.length)}
          subtext=""
        />

        <span className="grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-[#DDCEFF] bg-[#FBF8FF] text-[#6D3EE8]">
          <ChevronDown
            className={cls(
              "h-5 w-5 transition-transform",
              isOpen ? "rotate-180" : "",
            )}
          />
        </span>
      </button>

      {isOpen ? (
        <div className="border-t border-[#E2E6EE] bg-[#FCFDFF] p-4 lg:p-6">
          <div className="overflow-x-auto rounded-[14px] border border-[#DFE4ED] bg-white">
            <div className="grid min-w-[880px] grid-cols-[minmax(210px,1.25fr)_minmax(130px,0.78fr)_minmax(130px,0.78fr)_minmax(150px,0.82fr)_minmax(150px,0.82fr)] border-b border-[#E3E8F2] bg-[#FBFCFE] px-5 py-4 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#647089]">
              <div>Asset</div>
              <div>Value</div>
              <div>Price / 24h</div>
              <div>Current Profit</div>
              <div>Holdings</div>
            </div>
            <div>
              {chain.assets.map((asset) => {
                const value = assetValue(asset);
                const portfolioAllocation =
                  chain.valueUsd > 0 ? (value / chain.valueUsd) * chain.percent : 0;
                const assetProfitUp = asset.currentProfitUsd >= 0;

                return (
                  <div
                    key={asset.symbol}
                    className="grid min-h-[86px] min-w-[880px] grid-cols-[minmax(210px,1.25fr)_minmax(130px,0.78fr)_minmax(130px,0.78fr)_minmax(150px,0.82fr)_minmax(150px,0.82fr)] items-center border-t border-[#EDF1F7] px-5 py-3 first:border-t-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <CoinBadge
                        symbol={asset.symbol}
                        iconUrl={asset.iconUrl}
                        size="md"
                      />
                      <div className="min-w-0">
                        <strong className="block truncate text-sm text-[#17213A]">
                          {asset.name ?? asset.symbol}
                        </strong>
                      </div>
                    </div>
                    <AssetCell
                      value={usd(value)}
                      subtext={`${pct(portfolioAllocation)} portfolio`}
                    />
                    <AssetCell
                      value={usd4(asset.priceUsd)}
                      subtext={pct(asset.change24hPct)}
                      className={(asset.change24hPct ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}
                    />
                    <AssetCell
                      value={usd(asset.currentProfitUsd)}
                      subtext={`${pct(asset.currentProfitPct)} ROI`}
                      className={
                        assetProfitUp ? "text-emerald-600" : "text-red-600"
                      }
                    />
                    <AssetCell
                      value={`${qty(asset.qtyHeld)} ${asset.symbol}`}
                      subtext={`Avg. ${usd4(asset.avgPriceUsd)}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  subtext,
  className,
  valueClass,
}: {
  label: string;
  value: string;
  subtext: string;
  className?: string;
  valueClass?: string;
}) {
  return (
    <div
      className={cls(
        "min-h-[58px] flex-col justify-center border-l border-[#E7EAF1] px-6",
        className,
      )}
    >
      <label className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#65728C]">
        {label}
      </label>
      <strong className={cls("text-[17px] leading-none text-[#17213A]", valueClass)}>
        {value}
      </strong>
      <small className="mt-2 block text-[11px] font-medium text-[#7D8AA5]">
        {subtext}
      </small>
    </div>
  );
}

function AssetCell({
  value,
  subtext,
  className,
}: {
  value: string;
  subtext: string;
  className?: string;
}) {
  return (
    <div className={cls("min-w-0", className)}>
      <strong className="block truncate text-sm">{value}</strong>
      <small className="mt-1 block truncate text-[11px] font-medium text-[#7D8AA5]">
        {subtext}
      </small>
    </div>
  );
}

function ChainBadge({ chain }: { chain: ChainInfo }) {
  return (
    <span
      className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full shadow-[0_8px_18px_rgba(72,65,190,0.10)]"
      style={{ backgroundColor: `${chain.color}18`, color: chain.color }}
      aria-label={chain.name}
      title={chain.name}
    >
      <ChainMark chain={chain} />
    </span>
  );
}

function ChainMark({ chain }: { chain?: ChainInfo }) {
  const id = chain?.id ?? "ethereum";
  if (id === "ethereum") return <EthereumIcon />;
  if (id === "solana") return <SolanaIcon />;
  if (id === "xrp-ledger") return <XrpIcon />;
  if (id === "bitcoin") return <span className="text-2xl font-black">B</span>;
  if (id === "cardano") return <span className="text-xl font-black">ADA</span>;
  return (
    <span className="text-base font-black">
      {chain?.symbol ?? "ETH"}
    </span>
  );
}

function EthereumIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-6 w-6" aria-hidden="true">
      <path
        d="M20 4 30 20 20 25.6 10 20 20 4Z"
        fill="currentColor"
      />
      <path
        d="M20 28.2 30 22.4 20 36 10 22.4l10 5.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SolanaIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
      <path
        d="M10 11.5h22l-4.2 4.5h-22L10 11.5Zm2.2 6.2h22L30 22.2H8l4.2-4.5Zm-4 6.3h22L26 28.5H4l4.2-4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function XrpIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
      <path
        d="M9 11.5h5.1l5.9 5.7 5.9-5.7H31l-8.4 8.1a3.7 3.7 0 0 1-5.2 0L9 11.5Zm22 17h-5.1L20 22.8l-5.9 5.7H9l8.4-8.1a3.7 3.7 0 0 1 5.2 0L31 28.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PnlIcon({ down }: { down: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        d={down ? "m4 7 6 6 4-4 6 6" : "m4 17 6-6 4 4 6-6"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={down ? "M15 15h5v-5" : "M15 9h5v5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SummarySparkline({ color }: { color: string }) {
  return (
    <svg
      className="pointer-events-none absolute bottom-3 right-2 h-9 w-20 opacity-90"
      viewBox="0 0 112 50"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M1 45 C14 45,18 37,29 37 C40 37,42 43,52 35 C62 27,66 22,75 27 C85 32,91 26,97 14 C102 5,107 4,111 3 L111 50 L1 50 Z"
        fill={color}
        opacity="0.16"
      />
      <path
        d="M1 45 C14 45,18 37,29 37 C40 37,42 43,52 35 C62 27,66 22,75 27 C85 32,91 26,97 14 C102 5,107 4,111 3"
        fill="none"
        stroke={color}
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  );
}
