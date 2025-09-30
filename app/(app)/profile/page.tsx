import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getActiveAccountId } from "@/lib/account"
import Card from "@/components/ui/Card"
import ProfileEditor from "@/components/profile/ProfileEditor"

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)

  const [acc, strategiesCount, tradesCount] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId } }),
    prisma.strategy.count({ where: { account_id: accountId } }),
    prisma.journal_entry.count({ where: { account_id: accountId } }),
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

      <ProfileEditor />
    </div>
  )
}
