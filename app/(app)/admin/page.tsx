import "server-only"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function AdminHomePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return null

  const cards = [
    {
      href: "/admin/prompts",
      title: "Prompts",
      desc: "Edit the prompts used by the AI (including Trade Analyzer).",
      emoji: "✍️",
    },
    {
      href: "/admin/users",
      title: "Users",
      desc: "See all users, journals, strategies, and delete accounts.",
      emoji: "👥",
    },
    {
      href: "/admin/costs",
      title: "Costs",
      desc: "OpenAI spend by prompt type (daily/weekly/monthly).",
      emoji: "💳",
    },
  ]

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold mb-2">Admin Console</h1>
      <p className="text-sm text-gray-600 mb-6">Choose a section to manage.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl border p-5 hover:shadow-md bg-white transition"
          >
            <div className="text-3xl mb-2">{c.emoji}</div>
            <div className="font-semibold">{c.title}</div>
            <div className="text-sm text-gray-600">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
