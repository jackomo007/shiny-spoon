"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function DeleteJournalButton({ journalId, disabled }: { journalId: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function onDelete() {
    if (!confirm("Delete this journal? This action cannot be undone.")) return
    try {
      setLoading(true)
      const r = await fetch(`/api/journals/${journalId}`, { method: "DELETE" })
      if (!r.ok) throw new Error(await r.text())
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={disabled || loading}
      className="rounded-xl bg-orange-600 text-white px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
      title={disabled ? "You cannot delete the active journal" : "Delete journal"}
    >
      {loading ? "Deleting..." : "Delete"}
    </button>
  )
}
