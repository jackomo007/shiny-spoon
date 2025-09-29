"use client"

import { useEffect, useState } from "react"

type Item = {
  id: string
  key: string
  title: string
  description?: string | null
  content: string
  updated_at: string
}

export default function AdminPromptsClient() {
  const [items, setItems] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch("/api/admin/prompts", { cache: "no-store" })
      const js = (await res.json()) as { items?: Item[] }
      if (!cancelled) setItems(js.items ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function setContent(key: string, content: string) {
    setDirty((d) => ({ ...d, [key]: content }))
    setItems((arr) => arr.map((it) => (it.key === key ? { ...it, content } : it)))
  }

  async function save() {
    if (Object.keys(dirty).length === 0) return
    setSaving(true)
    try {
      const payload = {
        items: Object.entries(dirty).map(([key, content]) => ({ key, content })),
      }
      const res = await fetch("/api/admin/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      setDirty({})
      alert("Prompts salvos com sucesso.")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao salvar"
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {items.map((it) => (
        <div key={it.id} className="rounded-xl border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">
                {it.title}{" "}
                <span className="text-xs text-gray-500">({it.key})</span>
              </div>
              {it.description && (
                <div className="text-xs text-gray-500">{it.description}</div>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Update: {new Date(it.updated_at).toLocaleString()}
            </div>
          </div>
          <textarea
            className="mt-3 w-full rounded-xl border p-3 font-mono text-sm leading-5 min-h-[180px]"
            value={it.content}
            onChange={(e) => setContent(it.key, e.target.value)}
          />
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || Object.keys(dirty).length === 0}
          className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  )
}
