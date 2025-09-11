// components/journals/MakeActiveButton.tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function MakeActiveButton({ journalId }: { journalId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function makeActive() {
    try {
      setLoading(true)
      const r = await fetch("/api/journals/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: journalId }),
    })
      if (!r.ok) throw new Error(await r.text())
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to set active")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={makeActive}
      disabled={loading}
      className="rounded-xl bg-indigo-600 text-white px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-50"
    >
      {loading ? "Setting..." : "Make Active"}
    </button>
  )
}
