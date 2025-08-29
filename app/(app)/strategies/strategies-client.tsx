"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import Card from "@/components/ui/Card"
import Modal from "@/components/ui/Modal"
import { Table, Th, Tr, Td } from "@/components/ui/Table"

type Row = {
  id: string
  name: string | null
  date_created: string | Date
  rules: string[]
  tradesUsed?: number
  winRate?: number
  avgRR?: string | null
  avgReturnPct?: number
  pnl?: number
}

type UpsertPayload = {
  name: string
  rules: { value: string }[]
}

export default function StrategiesClient() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Row[]>([])

  // toolbar
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"new" | "az" | "za">("new")
  const [showFilter, setShowFilter] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  // modal create/edit
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [editingId, setEditingId] = useState<string | null>(null)

  // modal delete
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // form
  const { register, control, handleSubmit, reset, formState: { isSubmitting } } = useForm<UpsertPayload>({
    defaultValues: { name: "", rules: [{ value: "" }, { value: "" }] }
  })
  const { fields, append, remove, replace } = useFieldArray({ control, name: "rules" })

  async function load() {
    try {
      setLoading(true); setError(null)
      const r = await fetch("/api/strategies", { cache: "no-store" })
      if (!r.ok) throw new Error(await r.text())
      const data = (await r.json()) as Row[]
      const withKpis = data.map(d => ({
        ...d,
        tradesUsed: d.tradesUsed ?? 0,
        winRate: d.winRate ?? 0,
        avgRR: d.avgRR ?? "N/A",
        avgReturnPct: d.avgReturnPct ?? 0,
        pnl: d.pnl ?? 0
      }))
      setItems(withKpis)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load strategies")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  // filtro + sort
  const rows = useMemo(() => {
    let arr = items
    const q = query.trim().toLowerCase()
    if (q) arr = arr.filter(i => (i.name ?? "").toLowerCase().includes(q))
    switch (sort) {
      case "az": return [...arr].sort((a,b) => (a.name ?? "").localeCompare(b.name ?? ""))
      case "za": return [...arr].sort((a,b) => (b.name ?? "").localeCompare(a.name ?? ""))
      default:   return [...arr].sort((a,b) => +new Date(b.date_created) - +new Date(a.date_created))
    }
  }, [items, query, sort])

  function openCreate() {
    setMode("create"); setEditingId(null)
    reset({ name: "", rules: [{ value: "" }, { value: "" }] })
    setOpen(true)
  }
  function openEdit(row: Row) {
    setMode("edit"); setEditingId(row.id)
    const rulesArray = (row.rules.length ? row.rules : ["",""]).map(v => ({ value: v }))
    replace(rulesArray)
    reset({ name: row.name ?? "", rules: rulesArray })
    setOpen(true)
  }

  async function onSubmit(data: UpsertPayload) {
    const payload = {
      name: data.name.trim(),
      rules: data.rules.map(r => r.value.trim()).filter(Boolean)
    }
    if (!payload.name) {
      alert("Strategy Name is required")
      return
    }
    if (payload.rules.length < 1) {
      alert("Please add at least 1 rule")
      return
    }

    try {
      if (mode === "create") {
        const r = await fetch("/api/strategies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        if (!r.ok) throw new Error(await r.text())
      } else {
        const r = await fetch(`/api/strategies/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        if (!r.ok) throw new Error(await r.text())
      }
      setOpen(false)
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save")
    }
  }

  function askDelete(id: string) {
    setDeleteId(id)
    setConfirmOpen(true)
  }
  async function confirmDelete() {
    if (!deleteId) return
    try {
      setDeleting(true)
      const r = await fetch(`/api/strategies/${deleteId}`, { method: "DELETE" })
      if (!r.ok) throw new Error(await r.text())
      setConfirmOpen(false)
      setDeleteId(null)
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-end gap-3">
        <button className="flex items-center gap-2 rounded-xl bg-white text-gray-700 px-3 py-2 shadow-sm hover:bg-gray-50">📄 Export</button>
        <button className="flex items-center gap-2 rounded-xl bg-white text-gray-700 px-3 py-2 shadow-sm hover:bg-gray-50">⚙️ Settings</button>
        <button onClick={openCreate} className="h-10 w-10 rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-50">＋</button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <div className="flex justify-between">
            <div className="flex flex-col">
              <div className="text-sm text-gray-600">Top Performing Strategy</div>
              <div className="mt-2 text-2xl font-semibold">N/A</div>
            </div>
              <div className="right-0 top-0 h-10 w-10 grid place-items-center rounded-full bg-yellow-400 text-white">
                👥
              </div>
          </div>
        </Card>
        <Card>
          <div className="flex justify-between">
            <div className="flex flex-col">
              <div className="text-sm text-gray-600">Most Used Strategy</div>
              <div className="mt-2 text-2xl font-semibold">N/A</div>
            </div>
            <div className="right-0 top-0 h-10 w-10 grid place-items-center rounded-full bg-purple-500 text-white">
              👁️
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        {/* search bar */}
        {showSearch && (
          <div className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <span className="text-gray-400">🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type and hit enter ..."
                className="flex-1 outline-none bg-transparent text-gray-700 placeholder:text-gray-400"
              />
              <button onClick={() => setShowSearch(false)} className="text-gray-400 hover:text-gray-600">✖</button>
            </div>
          </div>
        )}

        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">My Strategies</h3>
          <div className="flex items-center gap-3 relative">
            <button onClick={() => setShowSearch(s => !s)} className="p-2 rounded-full hover:bg-gray-100">🔍</button>

            <div className="relative">
              <button onClick={() => { setShowFilter(f => !f); setShowMenu(false) }} className="p-2 rounded-full hover:bg-gray-100">🧰</button>
              {showFilter && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-20"
                     onMouseLeave={() => setShowFilter(false)}>
                  <MenuItem label="Newest" onClick={() => { setSort("new"); setShowFilter(false) }} icon="🧾"/>
                  <MenuItem label="From A-Z" onClick={() => { setSort("az"); setShowFilter(false) }} icon="🔤"/>
                  <MenuItem label="From Z-A" onClick={() => { setSort("za"); setShowFilter(false) }} icon="🔠"/>
                </div>
              )}
            </div>

            <div className="relative">
              <button onClick={() => { setShowMenu(m => !m); setShowFilter(false) }} className="p-2 rounded-full hover:bg-gray-100">⋯</button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-20"
                     onMouseLeave={() => setShowMenu(false)}>
                  <MenuItem label="Refresh" onClick={() => { load(); setShowMenu(false) }} />
                  <MenuItem label="Manage Widgets" onClick={() => setShowMenu(false)} />
                  <MenuItem label="Settings" onClick={() => setShowMenu(false)} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-2">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-red-600">{error}</div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Trades Used</Th>
                  <Th>Win Rate</Th>
                  <Th>Average R:R</Th>
                  <Th>Average Return %</Th>
                  <Th>Total PNL</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((r) => (
                    <Tr key={r.id}>
                      <Td>{r.name}</Td>
                      <Td>{r.tradesUsed}</Td>
                      <Td>{r.winRate}%</Td>
                      <Td>{r.avgRR}</Td>
                      <Td>{r.avgReturnPct}%</Td>
                      <Td>${r.pnl}</Td>
                      <Td>
                        <div className="flex gap-3 justify-end">
                          <button title="Edit" onClick={() => openEdit(r)} className="text-gray-600 hover:text-gray-800">✏️</button>
                          <button title="Delete" onClick={() => askDelete(r.id)} className="text-orange-600 hover:text-orange-700">🗑️</button>
                        </div>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-gray-500">No data</td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {/* Modal Create/Edit */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "Add Strategy" : "Edit Strategy"}
        footer={
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
              onClick={() => append({ value: "" })}
            >
              Add New Rule
            </button>
            <div className="flex items-center gap-3">
              <button className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200" onClick={() => setOpen(false)}>Cancel</button>
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
              >
                {mode === "create" ? "Add Strategy" : "Save Changes"}
              </button>
            </div>
          </div>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <div className="text-sm mb-1">Strategy Name <span className="text-red-600">*</span></div>
              <input
                {...register("name", { required: true })}
                placeholder=""
                className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {fields.map((f, idx) => (
              <div key={f.id}>
                <div className="text-sm mb-1">
                  Rule {idx === 0 && <span className="text-red-600">*</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    {...register(`rules.${idx}.value` as const)}
                    placeholder="Ex: Another rule…"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(idx)} className="px-3 rounded-xl bg-gray-100 hover:bg-gray-200">✖</button>
                  )}
                </div>
              </div>
            ))}
          </form>
        </div>
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete strategy?"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded-xl bg-orange-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-600">This action cannot be undone.</div>
      </Modal>

      <footer className="text-xs text-gray-500 py-6 flex items-center gap-6">
        <span>© 2025 Maverik AI. All rights reserved.</span>
        <a href="#" className="hover:underline">Support</a>
        <a href="#" className="hover:underline">Terms</a>
        <a href="#" className="hover:underline">Privacy</a>
      </footer>
    </div>
  )
}

function MenuItem({ label, onClick, icon }: { label: string; onClick: () => void; icon?: string }) {
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-xl flex items-center gap-3">
      {icon && <span>{icon}</span>}
      <span className="text-sm">{label}</span>
    </button>
  )
}
