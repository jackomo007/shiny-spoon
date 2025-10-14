import { prisma } from "@/lib/prisma"

export const PriceService = {
  async getPrices(symbols: string[]): Promise<Record<string, number>> {
    const uniq = Array.from(new Set(symbols.filter((s) => s && s !== "CASH")))
    if (!uniq.length) return {}

    const last = await prisma.journal_entry.findMany({
      where: { asset_name: { in: uniq }, spot_trade: { some: {} } },
      orderBy: { trade_datetime: "desc" },
      distinct: ["asset_name"],
      select: { asset_name: true, entry_price: true },
    })

    const map: Record<string, number> = {}
    for (const r of last) map[r.asset_name] = Number(r.entry_price)
    return map
  },
}
