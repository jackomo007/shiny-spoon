import { prisma } from "@/lib/prisma"

export async function getDefaultStrategyId(accountId: string): Promise<string> {
  const s = await prisma.strategy.findFirst({
    where: { account_id: accountId, name: { in: ["None", "none", "NONE"] } },
    select: { id: true },
  })
  if (!s) throw new Error('Default strategy "None" not found for account')
  return s.id
}

export async function isValidAssetName(sym: string): Promise<boolean> {
  const s = (sym || "").toUpperCase().trim()
  if (!s) return false
  const looksLikePair = /^[A-Z0-9]{5,15}$/.test(s) && /(USDT|USDC|USD|BTC|ETH)$/.test(s)
  if (looksLikePair) return true
  const found = await prisma.verified_asset.findUnique({ where: { symbol: s } })
  return !!found
}

export function qtyFrom(params: { amountSpent: number; entryPrice: number; tradeType: number; leverage?: number }): number {
  const { amountSpent, entryPrice, tradeType, leverage } = params
  if (entryPrice <= 0) return 0
  const notional = tradeType === 2 ? amountSpent * Math.max(1, leverage ?? 1) : amountSpent
  return notional / entryPrice
}

export function calcPnl(input: {
  side: "buy" | "sell" | "long" | "short"
  entry: number
  exit: number | null
  amountSpent: number
  leverage?: number | null
  tradeType: 1 | 2
  buyFee?: number
  sellFee?: number
  tradingFee?: number | null
}): number | null {
  if (input.exit == null) return null
  const dir = (input.side === "buy" || input.side === "long") ? 1 : -1
  const change = (input.exit - input.entry) / input.entry
  const notional = input.tradeType === 2
    ? input.amountSpent * Math.max(1, input.leverage ?? 1)
    : input.amountSpent
  const gross = dir * notional * change
  const fees = (input.tradingFee != null)
    ? Number(input.tradingFee)
    : (Number(input.buyFee ?? 0) + Number(input.sellFee ?? 0))
  const net = gross - fees
  return Number(net.toFixed(2))
}
