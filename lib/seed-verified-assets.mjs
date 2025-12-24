import { prisma } from "@/lib/prisma";

const COINS = [
  { symbol: "BTCUSDT", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "BNB", name: "BNB" },
  { symbol: "XRP", name: "XRP" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "HYPE", name: "Hyperliquid" },
];

async function main() {
  for (const c of COINS) {
    await prisma.verified_asset.upsert({
      where: { symbol: c.symbol },
      update: { name: c.name },
      create: { symbol: c.symbol, name: c.name, exchange: "Binance" },
    });
  }
  console.log("verified_asset seeded.");
}

main().finally(() => process.exit(0));
