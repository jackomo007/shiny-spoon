"use client"

import React from "react"

export type Point = { name: string; value: number }

type Props = {
  data: Point[]
  loading?: boolean
}

export default function EarningsChart({ data, loading }: Props) {
  if (loading) {
    return <div className="h-[220px] w-full rounded-xl bg-gray-100 animate-pulse" />
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[220px] w-full grid place-items-center text-sm text-gray-500 rounded-xl bg-gray-50">
        No data yet.
      </div>
    )
  }

  const W = 520, H = 220, PAD = 24
  const ys = data.map(d => d.value)
  const rawMin = Math.min(0, ...ys)
  const rawMax = Math.max(0, ...ys)
  const range = Math.max(1, rawMax - rawMin)
  const min = rawMin - range * 0.05
  const max = rawMax + range * 0.05

  const scaleX = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, data.length - 1)
  const scaleY = (v: number) => H - PAD - ((v - min) * (H - PAD * 2)) / Math.max(1, max - min)

  const path = data.map((d, i) =>
    `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(d.value)}`
  ).join(" ")

  const zeroY = scaleY(0)
  const showZero = zeroY >= PAD && zeroY <= H - PAD

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {showZero && (
        <line x1={PAD} x2={W - PAD} y1={zeroY} y2={zeroY} stroke="currentColor" opacity={0.2} />
      )}
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  )
}
