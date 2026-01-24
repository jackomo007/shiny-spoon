"use client"

import Image from "next/image"
import { cls } from "@/components/portfolio/format"

export type CoinBadgeMode = "coin" | "buy" | "sell" | "win" | "loss"

export function CoinBadge(props: {
  symbol: string
  iconUrl?: string | null
  mode?: CoinBadgeMode
  showBorder?: boolean
  size?: "sm" | "md"
  className?: string
}) {
  const symbol = (props.symbol ?? "").toUpperCase()
  const letter = symbol ? symbol[0] : "?"
  const mustShowBorder = props.showBorder ?? false
  const size = props.size ?? "md"
  const px = size === "sm" ? 24 : 32
  const wh = size === "sm" ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-[12px]"

  const mode: CoinBadgeMode = props.mode ?? "coin"

  if (mode === "buy") {
    return (
      <span
        className={cls("inline-flex items-center justify-center rounded-full font-bold select-none shrink-0", wh, props.className)}
        style={{ background: "#10B981", color: "#FFFFFF" }}
        aria-label={symbol}
        title={symbol}
      >
        {letter}
      </span>
    )
  }

  if (mode === "sell") {
    return (
      <span
        className={cls("inline-flex items-center justify-center rounded-full font-bold select-none shrink-0", wh, props.className)}
        style={{ background: "#EF4444", color: "#FFFFFF" }}
        aria-label={symbol}
        title={symbol}
      >
        {letter}
      </span>
    )
  }

  const ring =
    mode === "win"
      ? "ring-4 ring-emerald-500"
      : mode === "loss"
      ? "ring-4 ring-red-500"
      : ""

  if (props.iconUrl) {
    if (!mustShowBorder && !ring) {
      return (
        <Image
          src={props.iconUrl}
          alt={symbol}
          title={symbol}
          width={px}
          height={px}
          className={cls("rounded-full object-contain shrink-0", props.className)}
        />
      )
    }

    return (
      <span
        className={cls("relative inline-flex items-center justify-center rounded-full shrink-0", ring, props.className)}
        style={{ width: px, height: px }}
        aria-label={symbol}
        title={symbol}
      >
        <Image
          src={props.iconUrl}
          alt={symbol}
          width={px}
          height={px}
          className="rounded-full object-contain"
        />
      </span>
    )
  }

  return (
    <span
      className={cls(
        "inline-flex items-center justify-center rounded-full font-bold select-none shrink-0 bg-slate-200 text-slate-800",
        wh,
        props.className
      )}
      aria-label={symbol}
      title={symbol}
    >
      {letter}
    </span>
  )
}
