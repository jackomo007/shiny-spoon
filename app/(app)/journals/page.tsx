"use client"

import { useEffect, useState } from "react"
import Card from "@/components/ui/Card"
import Modal from "@/components/ui/Modal"

type Journal = { id: string; name: string; created_at: string }

export default function JournalsPage() {
  const [journals, setJournals] = useState<Journal[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch("/api/journals", { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      const data = await res.json().catch(() => ({})) 
      setJournals(data.items ?? [])
      setActiveId(data.activeJournalId ?? null)
    } catch (err) {
      console.error("Load journals failed", err)
      setJournals([])
      setActiveId(null)
    }
  }

  useEffect(() => { void load() }, [])

  async function addJournal(formData: FormData) {
    const name = formData.get("name")?.toString().trim()
    if (!name) return
    await fetch("/api/journals", {
      method: "POST",
      body: JSON.stringify({ name }),
      headers: { "Content-Type": "application/json" },
    })
    await load()
  }

  async function deleteJournal(id: string) {
    await fetch(`/api/journals/${id}`, { method: "DELETE" })
    setConfirmDelete(null)
    await load()
  }

  async function makeActive(id: string) {
    try {
      const res = await fetch("/api/journal/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || `Failed: ${res.status}`)
      }
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to make active")
    }
  }

  return (
    <div className="grid gap-6">
      <div className="text-2xl font-semibold">Journals</div>

      <Card>
        <form
          action={async (fd) => await addJournal(fd)}
          className="flex items-center gap-3"
        >
          <input name="name" placeholder="New journal name"
            className="rounded-xl border px-3 py-2 flex-1" />
          <button type="submit" className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm">
            Add
          </button>
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
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span>{j.name}</span>
                    {j.id === activeId && (
                      <span className="text-[11px] rounded-full px-2 py-0.5 bg-green-100 text-green-700">Active</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-500">
                  {new Date(j.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-3">
                    {j.id !== activeId && (
                      <button
                        onClick={() => void makeActive(j.id)}
                        className="px-3 py-1 rounded bg-purple-600 text-white text-xs hover:opacity-90"
                      >
                        Make Active
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDelete(j.id)}
                      className="px-3 py-1 rounded bg-orange-600 text-white text-xs hover:opacity-90"
                      disabled={j.id === activeId}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete journal?"
        footer={
          <div className="flex justify-end gap-3">
            <button
              className="rounded bg-gray-200 px-4 py-2 text-sm"
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </button>
            <button
              onClick={() => confirmDelete && deleteJournal(confirmDelete)}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:opacity-90"
            >
              Delete
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">This action cannot be undone.</p>
      </Modal>
    </div>
  )
}
