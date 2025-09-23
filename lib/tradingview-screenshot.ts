import chromium from "@sparticuz/chromium"
import puppeteer, { type Browser } from "puppeteer-core"

export type TVInterval = "60" | "240" | "D"

export async function captureTradingView(
  symbol: string,
  interval: TVInterval
): Promise<Buffer> {
  let browser: Browser | null = null
  try {
    const execPath = await chromium.executablePath()

    browser = await puppeteer.launch({
      executablePath: execPath,
      headless: true,
      args: chromium.args,
      defaultViewport: { width: 1280, height: 740 },
    })

    const page = await browser.newPage()
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    )

    const base = process.env.TRADINGVIEW_BASE ?? "https://www.tradingview.com/chart"
    const url = `${base}/?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`

    await page.goto(url, { waitUntil: "networkidle2", timeout: 120_000 })
    await page.waitForSelector("canvas, table.chart-markup-table, div#overlap-manager-root", {
      timeout: 120_000,
    })

    await new Promise((r) => setTimeout(r, 1500))

    const buffer = (await page.screenshot({ type: "png" })) as Buffer
    return buffer
  } finally {
    if (browser) { try { await browser.close() } catch {} }
  }
}
