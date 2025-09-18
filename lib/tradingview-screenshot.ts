import chromium from "@sparticuz/chromium"
import puppeteer, { type Browser } from "puppeteer-core"

export type TVInterval = "60" | "240" | "D"

function getExecutablePath(): string | undefined {
  // 1) variável de ambiente (recomendado)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }
  // 2) macOS Chrome padrão
  const macPath =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  return process.platform === "darwin" ? macPath : undefined
}

export async function captureTradingView(
  symbol: string,
  interval: TVInterval
): Promise<Buffer> {
  let browser: Browser | null = null
  try {
    const isProd = process.env.NODE_ENV === "production"
    const execPath = isProd ? await chromium.executablePath() : getExecutablePath()

    browser = await puppeteer.launch({
      args: isProd ? chromium.args : undefined,
      defaultViewport: { width: 1280, height: 740 },
      executablePath: execPath,
      headless: true,
    })

    const page = await browser.newPage()

    const base = process.env.TRADINGVIEW_BASE ?? "https://www.tradingview.com/chart"
    const url = `${base}/?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`
    await page.goto(url, { waitUntil: "networkidle2", timeout: 120_000 })

    await page.waitForSelector("canvas, table.chart-markup-table, div#overlap-manager-root", {
      timeout: 120_000,
    })

    const buffer = (await page.screenshot({ type: "png" })) as Buffer
    return buffer
  } finally {
    if (browser) {
      try { await browser.close() } catch {}
    }
  }
}
