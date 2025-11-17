"use client"

import { useEffect, useMemo, useState } from "react"
import Card from "@/components/ui/Card"
import { Table, Th, Tr, Td } from "@/components/ui/Table"
import { PieChart, Pie, Legend, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { useRouter } from "next/navigation"

type Item = {
  symbol: string
  amount: number
  priceUsd: number
  valueUsd: number
  percent: number
}

type PortfolioRes = {
  totalValueUsd: number
  items: Item[]
}

function usd(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

const colorFor = (name: string) => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 70% 50%)`
}

const dotColor = (sym: string) => colorFor(sym)

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioRes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as PortfolioRes
      setData(json)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const pieData = useMemo(
    () =>
      (data?.items ?? []).map((i) => ({
        name: i.symbol,
        percent: Number(i.percent.toFixed(6)),
      })),
    [data]
  )

  const handleAddAsset = () => {
    const qs = new URLSearchParams({
      from: "portfolio",
      open_spot_trade_modal: "1",
    })
    router.push(`/journal?${qs.toString()}`)
  }

  const handleEditAsset = (item: Item) => {
    const qs = new URLSearchParams({
      from: "portfolio",
      asset_name: item.symbol,
      open_spot_trade_modal: "1",
    })
    router.push(`/journal?${qs.toString()}`)
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio Manager</h1>
          <p className="text-sm text-gray-500">
            View your open spot positions at a glance
          </p>
        </div>

        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-xl bg-gray-900 text-white"
            onClick={handleAddAsset}
          >
            + Add Asset
          </button>
        </div>
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="h-[360px] w-full rounded-xl bg-gray-100 animate-pulse m-6" />
        ) : error ? (
          <div className="p-6 text-red-600">{error}</div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-6 text-sm text-gray-600">
            You don&apos;t have any open spot trades yet.
            <button
              className="ml-2 inline-flex items-center rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
              onClick={handleAddAsset}
            >
              Add your first asset
            </button>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="text-lg font-semibold">
                Total Portfolio Value: {usd(data.totalValueUsd)}
              </div>
            </div>

            <div className="h-[400px] rounded-xl border bg-white mb-6">
              <div className="px-4 pt-3 font-medium">Allocation (Open Spot Trades)</div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      dataKey="percent"
                      nameKey="name"
                      data={pieData}
                      outerRadius={110}
                      label
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={dotColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl bg-white">
              <Table>
                <thead>
                  <tr>
                    <Th>Asset</Th>
                    <Th>Asset Amount</Th>
                    <Th>Entry Price</Th>
                    <Th>Value</Th>
                    <Th>% Port.</Th>
                    <Th className="w-40">
                      <div className="flex justify-end pr-1">
                        Actions
                      </div>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((i) => (
                    <Tr key={i.symbol}>
                      <Td className="font-medium">
                        <span
                          className="inline-block mr-2 h-2.5 w-2.5 rounded-full align-middle"
                          style={{ background: dotColor(i.symbol) }}
                        />
                        {i.symbol}
                      </Td>
                      <Td>{i.amount.toFixed(8).replace(/\.?0+$/, "")}</Td>
                      <Td>{usd(i.priceUsd)}</Td>
                      <Td>{usd(i.valueUsd)}</Td>
                      <Td>{i.percent.toFixed(2)}%</Td>
                      <Td className="w-40">
                        <div className="flex justify-center">
                          <button
                            className="inline-flex items-center h-9 px-4 rounded-xl bg-gray-900 text-white text-sm"
                            onClick={() => handleEditAsset(i)}
                          >
                            Edit in Journal
                          </button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}
      </Card>

      <footer className="text-xs text-gray-500 py-6 flex items-center gap-6">
        <span>© 2025 Maverick AI. All rights reserved.</span>
      </footer>
    </div>
  )
}
