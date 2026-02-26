export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

import TradeAnalyzerClient from "@/components/trade-analyzer/TradeAnalyzerClient";

export default async function TradeAnalyzerPage() {
  return <TradeAnalyzerClient />;
}
