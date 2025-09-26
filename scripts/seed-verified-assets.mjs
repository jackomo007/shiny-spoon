import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * @typedef {Object} ExchangeSymbol
 * @property {string} symbol
 * @property {string} status
 * @property {string} quoteAsset
 * @property {boolean} isSpotTradingAllowed
 */

/**
 * @typedef {Object} ExchangeInfo
 * @property {ExchangeSymbol[]} symbols
 */

async function main() {
  console.log("⇒ Baixando símbolos da Binance…");
  const res = await fetch("https://api.binance.com/api/v3/exchangeInfo");
  if (!res.ok) throw new Error(`Falha ao buscar exchangeInfo: HTTP ${res.status}`);
  /** @type {ExchangeInfo} */
  const json = await res.json();

  const rows = json.symbols
    .filter((s) => s.isSpotTradingAllowed && s.status === "TRADING" && s.quoteAsset === "USDT")
    .map((s) => ({
      symbol: s.symbol.toUpperCase(),
      name: null,
      exchange: "Binance",
    }));

  const unique = Array.from(new Map(rows.map((r) => [r.symbol, r])).values());

  console.log(`⇒ Inserindo ${unique.length} assets verificados…`);
  const chunk = 500;
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    await prisma.verified_asset.createMany({
      data: slice,
      skipDuplicates: true,
    });
    console.log(`  - ${Math.min(i + chunk, unique.length)}/${unique.length}`);
  }

  console.log("✓ Finalizado");
}

await main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
