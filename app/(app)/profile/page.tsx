import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getActiveAccountId } from "@/lib/account"
import Card from "@/components/ui/Card"

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)

  const [acc, strategiesCount, tradesCount, recentTrades] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId } }),
    prisma.strategy.count({ where: { account_id: accountId } }),
    prisma.journal_entry.count({ where: { account_id: accountId } }),
    prisma.journal_entry.findMany({
      where: { account_id: accountId },
      orderBy: { trade_datetime: "desc" },
      select: { id: true, asset_name: true, status: true, trade_type: true, trade_datetime: true },
      take: 5,
    }),
  ])

  return (
    <div className="grid gap-6">
      <div className="text-2xl font-semibold">My profile</div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <div className="text-sm text-gray-600">Active account</div>
          <div className="mt-2 text-lg font-semibold">
            {acc?.name ?? "—"} <span className="text-sm text-gray-500">({acc?.type})</span>
          </div>
        </Card>
        <Card>
          <div className="text-sm text-gray-600">Strategies</div>
          <div className="mt-2 text-2xl font-semibold">{strategiesCount}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-600">Trades</div>
          <div className="mt-2 text-2xl font-semibold">{tradesCount}</div>
        </Card>
      </div>

      {/* <Card>
        <AccountTypeManager />
      </Card> */}

      <Card className="p-0 overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <div className="text-base font-semibold text-gray-800">Recent trades</div>
        </div>
        <div className="px-6 pb-6">
          {recentTrades.length === 0 ? (
            <div className="text-sm text-gray-500">No recent trades</div>
          ) : (
            <ul className="grid gap-2">
              {recentTrades.map(r => (
                <li key={r.id} className="text-sm flex items-center justify-between border rounded-xl px-3 py-2">
                  <span>{r.asset_name} — {r.trade_type === 2 ? "Futures" : "Spot"} — {r.status.replace("_", " ")}</span>
                  <span className="text-gray-500">{new Date(r.trade_datetime).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}
