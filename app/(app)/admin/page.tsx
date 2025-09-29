import "server-only"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import AdminPromptsClient from "./prompts-client"

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return null

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Console</h1>
      <p className="text-sm text-gray-600 mb-6">
        Version 1 — Editing prompts used by AI.
      </p>
      <AdminPromptsClient />
    </div>
  )
}
