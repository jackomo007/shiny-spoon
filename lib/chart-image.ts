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
  sidePanel?: boolean
}

// helpers
function avg(nums: number[]): number {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0
}
function sma(values: number[], period: number): number | null {
  if (values.length < period) return null
  const slice = values.slice(-period)
  return avg(slice)
}

export async function generateCandlePng(
  candles: Candle[],
  opts: ChartRenderOptions = {}
): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas")

  const width = opts.width ?? 1280
  const height = opts.height ?? 720
  const padding = opts.padding ?? 50
  const SIDE = opts.sidePanel === false ? 0 : 280 // painel

  const bull = opts.bullColor ?? "#16a34a"
  const bear = opts.bearColor ?? "#dc2626"
  const wick = opts.wickColor ?? "#374151"
  const bg = opts.bgColor ?? "#ffffff"
  const grid = opts.gridColor ?? "#e5e7eb"
  const axis = opts.axisColor ?? "#6b7280"
  const fontFamily =
    opts.font ?? "-apple-system, system-ui, Segoe UI, Roboto, sans-serif"

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext("2d")
  ctx.globalCompositeOperation = "source-over"
  ctx.textAlign = "left"
  ctx.textBaseline = "top"

  // fundo
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  if (candles.length === 0) {
    ctx.fillStyle = "#111827"
    ctx.font = `bold 20px ${fontFamily}`
    ctx.fillText("No data", padding, padding + 20)
    return canvas.toBuffer("image/png")
  }

  // área de plot
  const plotX = padding
  const plotY = padding + 20
  const plotW = Math.max(1, width - padding * 2 - SIDE)
  const plotH = height - padding * 2 - 20

  const lows = candles.map(c => c.low)
  const highs = candles.map(c => c.high)
  const opens = candles.map(c => c.open)
  const closes = candles.map(c => c.close)
  const volumes = candles.map(c => c.volume)

  const minL = Math.min(...lows)
  const maxH = Math.max(...highs)
  const range = maxH - minL || 1

  // grid
  ctx.strokeStyle = grid
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const y = plotY + (plotH * i) / 5
    ctx.beginPath()
    ctx.moveTo(plotX, y)
    ctx.lineTo(plotX + plotW, y)
    ctx.stroke()
  }

  // labels eixo Y
  ctx.fillStyle = axis
  ctx.font = `12px ${fontFamily}`
  for (let i = 0; i <= 5; i++) {
    const val = maxH - (range * i) / 5
    const y = plotY + (plotH * i) / 5
    ctx.fillText(val.toFixed(2), 8, y - 6)
  }

  // candles
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

    // wick
    ctx.strokeStyle = wick
    ctx.beginPath()
    ctx.moveTo(xCenter, yHigh)
    ctx.lineTo(xCenter, yLow)
    ctx.stroke()

    // corpo
    const up = c.close >= c.open
    ctx.fillStyle = up ? bull : bear
    const top = Math.min(yOpen, yClose)
    const h = Math.max(1, Math.abs(yClose - yOpen))
    ctx.fillRect(xCenter - half, top, bodyW, h)
  }

  // título
  const title = opts.title ?? `${opts.symbol ?? ""} ${opts.timeframeLabel ?? ""}`.trim()
  if (title) {
    ctx.fillStyle = "#111827"
    ctx.font = `bold 16px ${fontFamily}`
    ctx.fillText(title, plotX, padding - 10)
  }

  // ====== PAINEL LATERAL (dados tipo TradingView) ======
  if (SIDE > 0) {
    const panelX = width - padding - SIDE
    const panelY = padding
    const panelW = SIDE
    const panelH = height - padding * 2

    // fundo+bordas
    ctx.fillStyle = "#f9fafb"
    ctx.fillRect(panelX, panelY, panelW, panelH)
    ctx.strokeStyle = "#e5e7eb"
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1)

    const last = candles[candles.length - 1]
    const first = candles[0]
    const hi = Math.max(...highs)
    const lo = Math.min(...lows)

    // variação no período exibido
    const diff = last.close - first.open
    const pct = (diff / first.open) * 100

    // variação “24h” (se timeframe for h1 e houver >= 24 candles)
    let change24hAbs: number | null = null
    let change24hPct: number | null = null
    if (opts.timeframeLabel === "h1" && candles.length >= 25) {
      const prev = candles[candles.length - 25].close
      change24hAbs = last.close - prev
      change24hPct = (change24hAbs / prev) * 100
    }

    // volume
    const volLast = last.volume
    const avgVol30 = avg(volumes.slice(-30))

    // MAs (opcional, mostram um pouco do “Key stats”)
    const ma20 = sma(closes, 20)
    const ma50 = sma(closes, 50)

    let y = panelY + 14
    const line = (
      text: string,
      opt?: { bold?: boolean; color?: string; size?: number }
    ) => {
      ctx.fillStyle = opt?.color ?? "#111827"
      ctx.font = `${opt?.bold ? "bold " : ""}${opt?.size ?? 12}px ${fontFamily}`
      ctx.fillText(text, panelX + 12, y)
      y += (opt?.size ?? 12) + 8
    }

    // Cabeçalho
    line(`${opts.symbol ?? ""} / USDT`, { bold: true, size: 15 })
    line(`Exchange: Binance`)
    line(`Timeframe: ${opts.timeframeLabel ?? ""}`)
    y += 6

    // Preço grande e variação da janela
    line(last.close.toFixed(2), {
      bold: true,
      size: 24,
      color: diff >= 0 ? "#16a34a" : "#dc2626",
    })
    line(`${diff >= 0 ? "+" : ""}${diff.toFixed(2)} (${pct.toFixed(2)}%)`, {
      size: 14,
      color: diff >= 0 ? "#16a34a" : "#dc2626",
    })
    y += 6

    // 24h change (quando disponível)
    if (change24hAbs !== null && change24hPct !== null) {
      const up24 = change24hAbs >= 0
      line(
        `24h: ${up24 ? "+" : ""}${change24hAbs.toFixed(2)} (${change24hPct.toFixed(2)}%)`,
        { size: 13, color: up24 ? "#16a34a" : "#dc2626" }
      )
    }

    // High/Low + Volume
    line(`High: ${hi.toFixed(2)}`, { size: 13 })
    line(`Low : ${lo.toFixed(2)}`, { size: 13 })
    line(`Vol : ${volLast.toFixed(2)}`, { size: 13 })
    line(`Avg Vol (30): ${avgVol30.toFixed(2)}`, { size: 13 })

    // MAs (se existirem)
    if (ma20 !== null || ma50 !== null) {
      y += 4
      if (ma20 !== null) line(`MA20: ${ma20.toFixed(2)}`, { size: 13 })
      if (ma50 !== null) line(`MA50: ${ma50.toFixed(2)}`, { size: 13 })
    }

    // marca “Market open” (cripto é 24/7)
    y += 6
    line(`Market open`, { size: 12, color: "#16a34a" })
  }

  return canvas.toBuffer("image/png")
}
