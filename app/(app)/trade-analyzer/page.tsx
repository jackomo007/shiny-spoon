export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TradeAnalyzerClient from "@/components/trade-analyzer/TradeAnalyzerClient";

export default async function TradeAnalyzerPage() {
  const session = await getServerSession(authOptions);

  const strategies = session?.accountId
    ? await prisma.strategy.findMany({
        where: { account_id: session.accountId },
        orderBy: { date_created: "desc" },
        select: { id: true, name: true },
      })
    : [];

  return <TradeAnalyzerClient />;
}
