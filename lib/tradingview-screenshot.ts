import chromium from "@sparticuz/chromium"
import puppeteer, { type Browser } from "puppeteer-core"

export type TVInterval = "60" | "240" | "D"

function resolveExecutablePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const lambdaPath = chromium.executablePath()
  return typeof lambdaPath === "string" ? lambdaPath : undefined
}

export async function captureTradingView(
  symbol: string,
  interval: TVInterval
): Promise<Buffer> {
  let browser: Browser | null = null

  try {
    const executablePath = resolveExecutablePath()
    const isHeadless = true

    const launchOpts: Parameters<typeof puppeteer.launch>[0] = {
      headless: isHeadless,
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=1280,740",
      ],
      defaultViewport: { width: 1280, height: 740 },
      executablePath,
    }

    browser = await puppeteer.launch(launchOpts)
    const page = await browser.newPage()

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )

    const base = process.env.TRADINGVIEW_BASE ?? "https://www.tradingview.com/chart"
    await page.goto(base, { waitUntil: "networkidle2", timeout: 120_000 })

    await page.evaluate(
      (sym: string, itv: string) => {
        window.location.href = `/chart/?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(itv)}`
      },
      symbol,
      interval
    )

    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 120_000 })

    await page.waitForSelector("table.chart-markup-table, div#overlap-manager-root, canvas", {
      timeout: 120_000,
    })

    const buffer = (await page.screenshot({ type: "png" })) as Buffer
    return buffer
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch {
        // ignore
      }
    }
  }
}
