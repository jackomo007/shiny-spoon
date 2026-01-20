"use client"

import Card from "@/components/ui/Card"
import { Table, Th, Tr, Td } from "@/components/ui/Table"
import { usd, pct, qty, cls } from "@/components/portfolio/format"

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
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-4 border-b">
        <div className="font-semibold">Transactions</div>
        <div className="text-xs text-gray-500">All portfolio transactions (spot)</div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th>Asset</Th>
              <Th>Quantity</Th>
              <Th>Price</Th>
              <Th>Total</Th>
              <Th>Gain / Loss</Th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((t) => {
              const dt = new Date(t.executedAt)
              const isSell = t.side === "sell"
              const up = (t.gainLossUsd ?? 0) >= 0
              return (
                <Tr key={t.id}>
                  <Td className="text-sm text-gray-600">{dt.toLocaleString()}</Td>
                  <Td>
                    <span className={cls("text-xs font-semibold px-2 py-1 rounded-full", isSell ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                      {isSell ? "Sell" : "Buy"}
                    </span>
                  </Td>
                  <Td className="font-medium">
                    <div className="grid">
                      <span>{t.symbol}</span>
                      <span className="text-xs text-gray-500">{t.name ?? ""}</span>
                    </div>
                  </Td>
                  <Td>{qty(t.qty)}</Td>
                  <Td>{usd(t.priceUsd)}</Td>
                  <Td>{usd(t.totalUsd)}</Td>
                  <Td>
                    {isSell ? (
                      <span className={cls("font-medium", up ? "text-emerald-600" : "text-red-600")}>
                        {usd(t.gainLossUsd)} ({pct(t.gainLossPct)})
                      </span>
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
