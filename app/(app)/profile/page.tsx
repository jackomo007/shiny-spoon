import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getActiveAccountId } from "@/lib/account"
import type { account_type } from "@prisma/client"

function prettyType(t?: account_type | null) {
  if (!t) return "—"
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const userId = Number(session.user.id)

  let activeAccountId: string | null = await getActiveAccountId(userId)

  if (!activeAccountId) {
    const first = await prisma.account.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "asc" },
      select: { id: true },
    })
    activeAccountId = first?.id ?? null
  }

  if (!activeAccountId) {
    return (
      <div className="grid gap-6">
        <div className="text-2xl font-semibold">My profile</div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">Strategies: 0</div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">Trades: 0</div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">Recent: 0</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="text-gray-700">You don’t have any account yet.</div>
          <a
            href="/dashboard"
            className="mt-4 inline-block rounded-xl bg-primary text-white px-4 py-2 text-sm hover:opacity-90"
          >
            Go to Dashboard
          </a>
        </div>

        <footer className="text-xs text-gray-500 py-6 flex items-center gap-6">
          <span>© 2025 Maverik AI. All rights reserved.</span>
          <a href="#" className="hover:underline">Support</a>
          <a href="#" className="hover:underline">Terms</a>
          <a href="#" className="hover:underline">Privacy</a>
        </footer>
      </div>
    )
  }

  const [acc, strategiesCount, tradesCount, recentTrades] = await Promise.all([
    prisma.account.findUnique({
      where: { id: activeAccountId },
      select: { id: true, name: true, type: true, created_at: true },
    }),
    prisma.strategy.count({ where: { account_id: activeAccountId } }),
    prisma.journal_entry.count({ where: { account_id: activeAccountId } }),
    prisma.journal_entry.findMany({
      where: { account_id: activeAccountId },
      orderBy: { trade_datetime: "desc" },
      select: {
        id: true,
        asset_name: true,
        status: true,
        trade_type: true,
        trade_datetime: true,
      },
      take: 5,
    }),
  ])

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">My profile</div>
          <div className="text-sm text-gray-600 mt-1">
            Active account:{" "}
            <span className="font-medium">{acc?.name ?? "—"}</span>{" "}
            <span className="text-gray-400">({prettyType(acc?.type)})</span>
          </div>
        </div>
        <a
          href="/profile"
          className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
        >
          Refresh
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Strategies</div>
          <div className="mt-1 text-2xl font-semibold">{strategiesCount}</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Trades</div>
          <div className="mt-1 text-2xl font-semibold">{tradesCount}</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Recent (last 5)</div>
          <div className="mt-1 text-2xl font-semibold">{recentTrades.length}</div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="font-semibold mb-3">Recent trades</div>

        {recentTrades.length === 0 ? (
          <div className="text-sm text-gray-500">No recent trades</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4">Asset</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-2 pr-4">{t.asset_name}</td>
                    <td className="py-2 pr-4">{t.trade_type === 2 ? "Futures" : "Spot"}</td>
                    <td className="py-2 pr-4">{t.status.replace("_", " ")}</td>
                    <td className="py-2 pr-4">
                      {new Date(t.trade_datetime).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <a
            href="/journal"
            className="rounded-xl bg-primary text-white px-4 py-2 text-sm hover:opacity-90"
          >
            Go to Journal
          </a>
          <a
            href="/strategies"
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
          >
            Go to Strategies
          </a>
        </div>
      </div>

      <footer className="text-xs text-gray-500 py-6 flex items-center gap-6">
        <span>© 2025 Maverik AI. All rights reserved.</span>
        <a href="#" className="hover:underline">Support</a>
        <a href="#" className="hover:underline">Terms</a>
        <a href="#" className="hover:underline">Privacy</a>
      </footer>
    </div>
  )
}
