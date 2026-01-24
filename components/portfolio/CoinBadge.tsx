"use client"

import Image from "next/image"
import { cls } from "@/components/portfolio/format"

export type CoinBadgeMode = "coin" | "buy" | "sell" | "win" | "loss"

export function CoinBadge(props: {
  symbol: string
  iconUrl?: string | null
  mode?: CoinBadgeMode
  size?: "sm" | "md"
  className?: string
}) {
  const symbol = (props.symbol ?? "").toUpperCase()
  const letter = symbol ? symbol[0] : "?"

  const size = props.size ?? "md"
  const px = size === "sm" ? 24 : 32
  const whClass = size === "sm" ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-[12px]"

  const mode: CoinBadgeMode = props.mode ?? "coin"

  if (mode === "buy" || mode === "win") {
    return (
      <span
        className={cls(
          "inline-flex items-center justify-center rounded-full font-bold select-none shrink-0",
          whClass,
          props.className
        )}
        style={{ background: "#10B981", color: "#FFFFFF" }}
        aria-label={symbol}
        title={symbol}
      >
        {letter}
      </span>
    )
  }

  if (mode === "sell" || mode === "loss") {
    return (
      <span
        className={cls(
          "inline-flex items-center justify-center rounded-full font-bold select-none shrink-0",
          whClass,
          props.className
        )}
        style={{ background: "#EF4444", color: "#FFFFFF" }}
        aria-label={symbol}
        title={symbol}
      >
        {letter}
      </span>
    )
  }

  if (props.iconUrl) {
    return (
      <Image
        src={props.iconUrl}
        alt={symbol}
        title={symbol}
        width={px}
        height={px}
        className={cls("rounded-full object-contain shrink-0", props.className)}
        unoptimized={false}
      />
    )
  }

  return (
    <span
      className={cls(
        "inline-flex items-center justify-center rounded-full font-bold select-none shrink-0 bg-slate-200 text-slate-800",
        whClass,
        props.className
      )}
      aria-label={symbol}
      title={symbol}
    >
      {letter}
    </span>
  )
}
