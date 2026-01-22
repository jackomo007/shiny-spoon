"use client"

import { cls } from "@/components/portfolio/format"

function coinBaseColor(symbol: string) {
  const s = (symbol ?? "").toUpperCase()

  if (s === "BTC") return { bg: "#F7931A", fg: "#0B0F19" }
  if (s === "ETH") return { bg: "#627EEA", fg: "#0B0F19" }
  if (s === "BNB") return { bg: "#F3BA2F", fg: "#0B0F19" }
  if (s === "SOL") return { bg: "#7C3AED", fg: "#0B0F19" }
  if (s === "USDC") return { bg: "#2775CA", fg: "#0B0F19" }
  if (s === "USDT") return { bg: "#26A17B", fg: "#0B0F19" }
  if (s === "XRP") return { bg: "#111827", fg: "#FFFFFF" }
  if (s === "ADA") return { bg: "#0B4AA2", fg: "#FFFFFF" }
  if (s === "DOGE") return { bg: "#C2A633", fg: "#0B0F19" }

  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const hue = h % 360
  return { bg: `hsl(${hue} 70% 45%)`, fg: "#0B0F19" }
}

export function CoinBadge(props: {
  symbol: string
  mode?: "coin" | "buy" | "sell"
  size?: "sm" | "md"
  className?: string
}) {
  const symbol = (props.symbol ?? "").toUpperCase()
  const letter = symbol ? symbol[0] : "?"

  const size = props.size ?? "md"
  const wh = size === "sm" ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-[12px]"

  let style: { background: string; color: string }
  if (props.mode === "buy") {
    style = { background: "#10B981", color: "#FFFFFF" }
  } else if (props.mode === "sell") {
    style = { background: "#EF4444", color: "#FFFFFF" }
  } else {
    const c = coinBaseColor(symbol)
    style = { background: c.bg, color: c.fg }
  }

  return (
    <span
      className={cls(
        "inline-flex items-center justify-center rounded-full font-bold select-none shrink-0",
        wh,
        props.className
      )}
      style={style}
      aria-label={symbol}
      title={symbol}
    >
      {letter}
    </span>
  )
}
