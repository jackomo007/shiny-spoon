"use client"

import Card from "@/components/ui/Card"
import { Table, Th, Tr, Td } from "@/components/ui/Table"
import { usd, pct, qty, cls } from "@/components/portfolio/format"

export type AssetRow = {
  symbol: string
  name: string | null
  coingeckoId: string | null
  priceUsd: number
  change24hPct: number | null
  totalInvestedUsd: number
  avgPriceUsd: number
  qtyHeld: number
  holdingsValueUsd: number
  currentProfitUsd: number
  currentProfitPct: number | null
}

export default function AssetsTable(props: { assets: AssetRow[] }) {
  const rows = props.assets

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-4 border-b">
        <div className="font-semibold">Assets</div>
        <div className="text-xs text-gray-500">Spot holdings only</div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <thead>
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
                    <div className="grid">
                      <span>{a.symbol}</span>
                      <span className="text-xs text-gray-500">{a.name ?? ""}</span>
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
                      <span className="text-xs text-gray-500">{qty(a.qtyHeld)} {a.symbol}</span>
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </div>
    </Card>
  )
}
