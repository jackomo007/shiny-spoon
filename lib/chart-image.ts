import "server-only"
import type { Candle } from "./klines"

export type ChartRenderOptions = {
  width?: number
  height?: number
  padding?: number
  bullColor?: string
  bearColor?: string
  bgColor?: string
  gridColor?: string
  axisColor?: string
  wickColor?: string
  font?: string
  title?: string
  symbol?: string
  timeframeLabel?: string
}

export async function generateCandlePng(
  candles: Candle[],
  opts: ChartRenderOptions = {}
): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas")

  const width = opts.width ?? 1280
  const height = opts.height ?? 720
  const padding = opts.padding ?? 50

  const bull = opts.bullColor ?? "#16a34a"
  const bear = opts.bearColor ?? "#dc2626"
  const wick = opts.wickColor ?? "#111827"
  const bg = opts.bgColor ?? "#ffffff"
  const grid = opts.gridColor ?? "#e5e7eb"
  const axis = opts.axisColor ?? "#6b7280"
  const font = opts.font ?? "12px sans-serif"

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext("2d")

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  if (candles.length === 0) {
    ctx.fillStyle = "#000"
    ctx.font = "bold 20px sans-serif"
    ctx.fillText("No data", padding, padding + 20)
    return canvas.toBuffer("image/png")
  }

  const plotX = padding
  const plotY = padding + 20
  const plotW = width - padding * 2
  const plotH = height - padding * 2 - 20

  const minL = Math.min(...candles.map(c => c.low))
  const maxH = Math.max(...candles.map(c => c.high))
  const range = maxH - minL || 1

  ctx.strokeStyle = grid
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const y = plotY + (plotH * i) / 5
    ctx.beginPath()
    ctx.moveTo(plotX, y)
    ctx.lineTo(plotX + plotW, y)
    ctx.stroke()
  }

  ctx.fillStyle = axis
  ctx.font = font
  for (let i = 0; i <= 5; i++) {
    const val = maxH - (range * i) / 5
    const y = plotY + (plotH * i) / 5
    ctx.fillText(val.toFixed(2), 8, y + 4)
  }

  const n = candles.length
  const colW = plotW / n
  const bodyW = Math.max(2, Math.floor(colW * 0.6))
  const half = Math.floor(bodyW / 2)

  for (let i = 0; i < n; i++) {
    const c = candles[i]
    const xCenter = Math.floor(plotX + i * colW + colW / 2)

    const yHigh = plotY + Math.floor(((maxH - c.high) / range) * plotH)
    const yLow = plotY + Math.floor(((maxH - c.low) / range) * plotH)
    const yOpen = plotY + Math.floor(((maxH - c.open) / range) * plotH)
    const yClose = plotY + Math.floor(((maxH - c.close) / range) * plotH)

    ctx.strokeStyle = wick
    ctx.beginPath()
    ctx.moveTo(xCenter, yHigh)
    ctx.lineTo(xCenter, yLow)
    ctx.stroke()

    const up = c.close >= c.open
    ctx.fillStyle = up ? bull : bear
    const top = Math.min(yOpen, yClose)
    const h = Math.max(1, Math.abs(yClose - yOpen))
    ctx.fillRect(xCenter - half, top, bodyW, h)
  }

  const title =
    opts.title ?? `${opts.symbol ?? ""} ${opts.timeframeLabel ?? ""}`.trim()
  if (title) {
    ctx.fillStyle = "#111827"
    ctx.font = "bold 16px sans-serif"
    ctx.fillText(title, plotX, padding - 6)
  }

  return canvas.toBuffer("image/png")
}
