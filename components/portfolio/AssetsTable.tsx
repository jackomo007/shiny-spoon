"use client"

import Card from "@/components/ui/Card"
import { Table, Th, Tr, Td } from "@/components/ui/Table"
import { usd, pct, qty, cls } from "@/components/portfolio/format"
import { CoinBadge } from "@/components/portfolio/CoinBadge"

export type AssetRow = {
  symbol: string
  name: string | null
  coingeckoId: string | null
  iconUrl: string | null
  priceUsd: number
  change24hPct: number | null
  totalInvestedUsd: number
  avgPriceUsd: number
  qtyHeld: number
  holdingsValueUsd: number
  currentProfitUsd: number
  currentProfitPct: number | null
}

export default function AssetsTable(props: { assets: AssetRow[]; title?: string }) {
  const rows = props.assets

  return (
    <Card className="p-0 rounded-2xl overflow-hidden">
      <div className="pt-1 pb-3 flex items-center justify-between gap-3">
        <div className="font-semibold text-[#0f172a]">
          {props.title ?? "Your Assets"}
        </div>
      </div>

        <Table>
          <thead className="border-b border-[#eef2f7]">
            <tr>
              <Th>Asset</Th>
              <Th>Price / 24h</Th>
              <Th>Total Invested</Th>
              <Th>Avg. Price</Th>
              <Th>Current Profit</Th>
              <Th>Holdings</Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((a) => {
              const up24 = (a.change24hPct ?? 0) >= 0
              const upPnl = (a.currentProfitUsd ?? 0) >= 0

              return (
                <Tr key={a.symbol}>
                  <Td className="font-medium">
                    <div className="flex items-center gap-3">
                      <CoinBadge symbol={a.symbol} iconUrl={a.iconUrl ?? null} mode="coin" />

                      <div className="grid">
                        <span className="text-[#0f172a]">{a.symbol}</span>
                        <span className="text-xs text-gray-500">{a.name ?? ""}</span>
                      </div>
                    </div>
                  </Td>

                  <Td>
                    <div className="grid">
                      <span className="font-medium">{usd(a.priceUsd)}</span>
                      <span className={cls("text-xs", up24 ? "text-emerald-600" : "text-red-600")}>
                        {pct(a.change24hPct)}
                      </span>
                    </div>
                  </Td>

                  <Td>{usd(a.totalInvestedUsd)}</Td>
                  <Td>{usd(a.avgPriceUsd)}</Td>

                  <Td>
                    <div className="grid">
                      <span className={cls("font-medium", upPnl ? "text-emerald-600" : "text-red-600")}>
                        {usd(a.currentProfitUsd)}
                      </span>
                      <span className={cls("text-xs", upPnl ? "text-emerald-600" : "text-red-600")}>
                        {pct(a.currentProfitPct)}
                      </span>
                    </div>
                  </Td>

                  <Td>
                    <div className="grid">
                      <span className="font-medium">{usd(a.holdingsValueUsd)}</span>
                      <span className="text-xs text-gray-500">
                        {qty(a.qtyHeld)} {a.symbol}
                      </span>
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
    </Card>
  )
}
