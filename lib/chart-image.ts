// lib/chart-image.ts
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
  sidePanelWidth?: number
  /** 
   * none = sem painel
   * bg   = desenha só o retângulo do painel (fundo/borda), sem textos
   * full = painel completo com textos
   */
  sidePanelMode?: "none" | "bg" | "full"
  debugText?: boolean
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B"
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M"
  if (abs >= 1_000) return (n / 1_000).toFixed(2) + "K"
  return n.toFixed(2)
}

let fontsReady = false

export async function generateCandlePng(
  candles: Candle[],
  opts: ChartRenderOptions = {}
): Promise<Buffer> {
  const { createCanvas, GlobalFonts } = await import("@napi-rs/canvas")

  if (!fontsReady) {
    try {
      const root = process.cwd()
      GlobalFonts.registerFromPath(`${root}/public/fonts/Inter-Regular.ttf`, "Inter")
      GlobalFonts.registerFromPath(`${root}/public/fonts/Inter-Bold.ttf`, "Inter Bold")
    } catch (e) {
      console.warn("Font register failed:", e)
    } finally {
      fontsReady = true
    }
  }

  const family =
    (opts.font && GlobalFonts.has(opts.font)) ? opts.font :
    (GlobalFonts.has("Inter") ? "Inter" : "sans-serif")

  const width = opts.width ?? 1280
  const height = opts.height ?? 720
  const padding = opts.padding ?? 48

  // >>> NOVO: modo do painel
  const panelMode = opts.sidePanelMode ?? "full"
  const rawSide = Math.max(0, opts.sidePanelWidth ?? 280)
  const SIDE = panelMode === "none" ? 0 : rawSide

  const plotX = padding
  const plotY = padding
  const plotW = width - padding * 2 - SIDE
  const plotH = height - padding * 2

  const bull = opts.bullColor ?? "#16a34a"
  const bear = opts.bearColor ?? "#dc2626"
  const wick = opts.wickColor ?? "#374151"
  const bg = opts.bgColor ?? "#ffffff"
  const grid = opts.gridColor ?? "#eef2f7"
  const axis = opts.axisColor ?? "#6b7280"

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext("2d")
  ctx.textBaseline = "top"
  ctx.textAlign = "left"

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  if (opts.debugText) {
    ctx.fillStyle = "#111827"
    ctx.font = `bold 18px ${family}`
    ctx.fillText("DEBUG", 10, 10)
  }

  if (candles.length === 0) {
    ctx.fillStyle = "#111827"
    ctx.font = `bold 20px ${family}`
    ctx.fillText("No data", padding, padding + 20)
    return canvas.toBuffer("image/png")
  }

  const minL = Math.min(...candles.map(c => c.low))
  const maxH = Math.max(...candles.map(c => c.high))
  const range = Math.max(1e-9, maxH - minL)

  // grid horizontal
  ctx.strokeStyle = grid
  ctx.lineWidth = 1
  const gridLines = 5
  for (let i = 0; i <= gridLines; i++) {
    const y = plotY + (plotH * i) / gridLines
    ctx.beginPath()
    ctx.moveTo(plotX, y)
    ctx.lineTo(plotX + plotW, y)
    ctx.stroke()
  }

  // labels do eixo Y
  ctx.fillStyle = axis
  ctx.font = `12px ${family}`
  for (let i = 0; i <= gridLines; i++) {
    const val = maxH - (range * i) / gridLines
    const y = plotY + (plotH * i) / gridLines
    ctx.fillText(val.toFixed(2), Math.max(8, plotX - 42), y + 4)
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

  const title = opts.title ?? `${opts.symbol ?? ""} · ${opts.timeframeLabel ?? ""}`.trim()
  if (title) {
    ctx.fillStyle = "#111827"
    ctx.font = `bold 16px ${family}`
    ctx.fillText(title, plotX, Math.max(22, plotY - 10))
  }

  // Painel lateral
  if (SIDE > 0) {
    const panelX = width - SIDE - padding
    const panelY = padding
    const panelW = SIDE
    const panelH = plotH

    // fundo + borda SEMPRE que SIDE > 0
    ctx.fillStyle = "#f8fafc"
    ctx.fillRect(panelX, panelY, panelW, panelH)
    ctx.strokeStyle = "#e5e7eb"
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1)

    // Só desenha textos/estatísticas se o modo for "full"
    if (opts.sidePanelMode !== "bg") {
      const last = candles[candles.length - 1]
      const first = candles[0]
      const diff = last.close - first.open
      const pct = (diff / first.open) * 100
      const avgVol =
        candles.slice(-30).reduce((s, c) => s + c.volume, 0) /
        Math.max(1, Math.min(30, candles.length))

      let y = panelY + 20
      const line = (txt: string, bold = false, color = "#111827", size = 14) => {
        ctx.fillStyle = color
        ctx.font = `${bold ? "bold " : ""}${size}px ${family}`
        ctx.fillText(txt, panelX + 16, y)
        y += size + 8
      }

      line(`${opts.symbol ?? "SYMBOL"} / USDT`, true, "#111827", 15)
      line(`Exchange: Binance`)
      line(`Timeframe: ${opts.timeframeLabel ?? "-"}`)

      y += 6
      const up = diff >= 0
      line(`${last.close.toFixed(2)} USDT`, true, up ? "#16a34a" : "#dc2626", 24)
      line(`${up ? "+" : ""}${diff.toFixed(2)} (${pct.toFixed(2)}%)`, false, up ? "#16a34a" : "#dc2626")

      y += 6
      line(`High: ${last.high.toFixed(2)}`)
      line(`Low : ${last.low.toFixed(2)}`)
      line(`Volume: ${fmtCompact(last.volume)}`)
      line(`Avg Vol (30): ${fmtCompact(avgVol)}`)

      y += 10
      const dotX = panelX + 16
      const dotY = y + 2
      ctx.fillStyle = "#22c55e"
      ctx.beginPath()
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#374151"
      ctx.font = `12px ${family}`
      ctx.fillText("Market open", dotX + 10, y - 4)
    }
  }

  return canvas.toBuffer("image/png")
}
