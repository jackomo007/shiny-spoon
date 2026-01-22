"use client"

import { useMemo, useState } from "react"
import Card from "@/components/ui/Card"
import { Table, Th, Tr, Td } from "@/components/ui/Table"
import { usd, pct, qty, cls } from "@/components/portfolio/format"
import { CoinBadge } from "@/components/portfolio/CoinBadge"

export type TxRow = {
  id: string
  side: "buy" | "sell"
  symbol: string
  name: string | null
  executedAt: string
  qty: number
  priceUsd: number
  totalUsd: number
  gainLossUsd: number | null
  gainLossPct: number | null
}

export default function TransactionsTable(props: { rows: TxRow[] }) {
  const [q, setQ] = useState("")

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return props.rows

    return props.rows.filter((r) => {
      const s = `${r.symbol} ${r.name ?? ""} ${r.side}`.toLowerCase()
      return s.includes(query)
    })
  }, [props.rows, q])

  return (
    <Card className="p-0 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#eef2f7] flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Transactions</div>
          <div className="text-xs text-gray-500">All portfolio transactions (spot)</div>
        </div>

        <input
          className="w-[280px] max-w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>Type</Th>
              <Th>Quantity</Th>
              <Th>Price</Th>
              <Th>Total</Th>
              <Th className="text-right">Gain / Loss</Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((t) => {
              const dt = new Date(t.executedAt)
              const isSell = t.side === "sell"

              const pnl = t.gainLossUsd
              const pnlUp = (pnl ?? 0) >= 0

              return (
                <Tr key={t.id}>
                  <Td className="font-medium">
                    <div className="flex items-center gap-3">
                      <CoinBadge symbol={t.symbol} mode={isSell ? "sell" : "buy"} size="md" />

                      <div className="grid">
                        <div className="text-[#0f172a]">
                          {isSell ? "Sell" : "Buy"} {t.symbol}
                        </div>
                        <div className="text-xs text-gray-500">{dt.toLocaleString()}</div>
                      </div>
                    </div>
                  </Td>

                  <Td className="text-[#0f172a]">
                    {isSell ? "-" : "+"}
                    {qty(Math.abs(t.qty))} {t.symbol}
                  </Td>

                  <Td className="text-[#0f172a]">{usd(t.priceUsd)}</Td>
                  <Td className="text-[#0f172a]">{usd(t.totalUsd)}</Td>

                  <Td className="text-right">
                    {isSell ? (
                      <div className="grid justify-end">
                        <span className={cls("font-semibold", pnlUp ? "text-emerald-600" : "text-red-600")}>
                          {usd(t.gainLossUsd)}
                        </span>
                        <span className={cls("text-xs", pnlUp ? "text-emerald-600" : "text-red-600")}>
                          {pct(t.gainLossPct)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
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
