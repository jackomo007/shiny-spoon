"use client"

import { useEffect, useMemo, useState } from "react"

type UserRow = {
  id: number
  email: string
  username: string
  is_admin: boolean
  created_at: string
}

type JournalRow = {
  id: string
  asset_name: string
  trade_type: number
  side: string
  status: string
  trade_datetime: string
  amount_spent: string
  entry_price: string
  exit_price: string | null
}

type StrategyRow = {
  id: string
  name: string | null
  date_created: string | null
  rules: string[]
}

export default function AdminUsersClient() {
  const [items, setItems] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")

  const [showJ, setShowJ] = useState<null | { user: UserRow; rows: JournalRow[] }>(null)
  const [showS, setShowS] = useState<null | { user: UserRow; rows: StrategyRow[] }>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/admin/users", { cache: "no-store" })
        const js = (await res.json()) as { items?: UserRow[]; error?: unknown }
        if (!cancel) setItems(js.items ?? [])
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return items
    return items.filter(u =>
      [u.email, u.username].some(v => v?.toLowerCase().includes(term))
    )
  }, [items, q])

  async function openJournals(u: UserRow) {
    const res = await fetch(`/api/admin/users/${u.id}/journals`, { cache: "no-store" })
    const js = (await res.json()) as { items?: JournalRow[] }
    setShowJ({ user: u, rows: js.items ?? [] })
  }

  async function openStrategies(u: UserRow) {
    const res = await fetch(`/api/admin/users/${u.id}/strategies`, { cache: "no-store" })
    const js = (await res.json()) as { items?: StrategyRow[] }
    setShowS({ user: u, rows: js.items ?? [] })
  }

  async function toggleAdmin(u: UserRow) {
    const next = !u.is_admin
    setToggling(String(u.id))
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_admin: next }),
      })
      const js = await res.json()
      if (!res.ok) throw new Error(js?.error || `HTTP ${res.status}`)
      setItems(prev => prev.map(x => (x.id === u.id ? { ...x, is_admin: next } : x)))
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed"
      alert(msg)
    } finally {
      setToggling(null)
    }
  }

  async function deleteUser(u: UserRow) {
    const label = u.username || u.email
    const confirmInput = window.prompt(
      `Type the username/email exactly to delete this user:\n\n${label}`
    )
    if (!confirmInput) return
    setDeleting(String(u.id))
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmInput }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      setItems(prev => prev.filter(x => x.id !== u.id))
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed"
      alert(msg)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">All users</h2>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search email or username…"
          className="w-64 max-w-[60vw] rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-[820px] w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Created</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">No users</td></tr>
            ) : (
              filtered.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="p-3 font-medium">{u.username}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">
                    {u.is_admin ? (
                      <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-xs">Admin</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">User</span>
                    )}
                  </td>
                  <td className="p-3">{new Date(u.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openJournals(u)}
                        className="rounded-lg border px-2 py-1 hover:bg-gray-50 cursor-pointer"
                        title="View trading journal"
                      >
                        📓 Journals
                      </button>
                      <button
                        onClick={() => openStrategies(u)}
                        className="rounded-lg border px-2 py-1 hover:bg-gray-50 cursor-pointer"
                        title="View strategies"
                      >
                        🧭 Strategies
                      </button>
                      <button
                        onClick={() => toggleAdmin(u)}
                        disabled={toggling === String(u.id)}
                        className="rounded-lg border px-2 py-1 hover:bg-gray-50 cursor-pointer"
                        title={u.is_admin ? "Remove admin" : "Make admin"}
                      >
                        🛡️ {u.is_admin ? "Remove admin" : "Make admin"}
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        disabled={deleting === String(u.id)}
                        className="rounded-lg border px-2 py-1 hover:bg-red-50 text-red-600 disabled:opacity-50 cursor-pointer"
                        title="Delete user"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showJ && (
        <Modal onClose={() => setShowJ(null)} title={`Journals — ${showJ.user.username || showJ.user.email}`}>
          {showJ.rows.length === 0 ? (
            <div className="text-sm text-gray-500">No journal entries.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {showJ.rows.map(r => (
                <li key={r.id} className="rounded-lg border p-2">
                  <div className="font-medium">
                    {r.asset_name} — {r.side} — {new Date(r.trade_datetime).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">
                    Entry: {r.entry_price} · Exit: {r.exit_price ?? "—"} · Spent: {r.amount_spent}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {showS && (
        <Modal onClose={() => setShowS(null)} title={`Strategies — ${showS.user.username || showS.user.email}`}>
          {showS.rows.length === 0 ? (
            <div className="text-sm text-gray-500">No strategies.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {showS.rows.map(s => (
                <li key={s.id} className="rounded-lg border p-2">
                  <div className="font-medium">{s.name ?? "Untitled"}</div>
                  <div className="text-xs text-gray-600">
                    {s.rules.length ? `Rules: ${s.rules.join(", ")}` : "No rules"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/30" onClick={onClose}>
      <div
        className="absolute left-1/2 top-16 -translate-x-1/2 w-[720px] max-w-[95vw] rounded-2xl bg-white shadow-2xl p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-2">
          <div className="font-semibold">{title}</div>
          <button
            className="rounded-full px-2 py-1 text-gray-500 hover:bg-gray-100 cursor-pointer"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ✖
          </button>
        </div>
        <div className="pt-3">{children}</div>
      </div>
    </div>
  )
}
