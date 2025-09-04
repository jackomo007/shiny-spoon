import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getActiveAccountId } from "@/lib/account"
import Card from "@/components/ui/Card"

export default async function JournalsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")
  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) redirect("/profile")

  const journals = await prisma.journal.findMany({
    where: { account_id: accountId },
    orderBy: { created_at: "asc" },
    select: { id: true, name: true, created_at: true },
  })

  return (
    <div className="grid gap-6">
      <div className="text-2xl font-semibold">Journals</div>

      <Card>
        <form action="/api/journals" method="post" className="flex items-center gap-3">
          <input name="name" placeholder="New journal name" className="rounded-xl border px-3 py-2" />
          <button type="submit" className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm">Add</button>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {journals.map(j => (
              <tr key={j.id} className="border-t">
                <td className="px-3 py-2">{j.name}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(j.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <form
                    action={`/api/journals/${j.id}`}
                    method="post"
                    className="flex justify-end"
                    onSubmit={(e) => {
                      e.preventDefault()
                      fetch(`/api/journals/${j.id}`, { method: "DELETE" }).then(() => location.reload())
                    }}
                  >
                    <button className="text-orange-700 hover:underline">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
