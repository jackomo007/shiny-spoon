"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import Card from "@/components/ui/Card"
import Modal from "@/components/ui/Modal"
import { Table, Th, Tr, Td } from "@/components/ui/Table"

type Row = {
  id: string
  name: string | null
  date_created: string | Date
  rules: string[]
  tradesUsed: number
  winRate: number
  avgRR: string | null
  pnl: number
}

type RuleRow = { id: string; title: string; description?: string | null }
type StrategyDetail = {
  id: string
  name: string | null
  date_created: string | Date | null
  rules: { id: string; title: string; description: string | null }[]
}

export default function StrategiesClient() {
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Row[]>([])

  const [showSearch, setShowSearch] = useState<boolean>(false)
  const [query, setQuery] = useState<string>("")
  const [sort, setSort] = useState<"new" | "az" | "za">("new")
  const [showFilter, setShowFilter] = useState<boolean>(false)
  const [showMenu, setShowMenu] = useState<boolean>(false)

  const [open, setOpen] = useState<boolean>(false)
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [editingId, setEditingId] = useState<string | null>(null)

  const [confirmOpen, setConfirmOpen] = useState<boolean>(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<boolean>(false)

  const [start, setStart] = useState<string>(() => {
    const end = new Date()
    const s = new Date(new Date().setMonth(end.getMonth() - 6))
    return s.toISOString().slice(0, 10)
  })
  const [end, setEnd] = useState<string>(() => new Date().toISOString().slice(0, 10))

  const [summary, setSummary] = useState<{ topPerformingId: string | null; mostUsedId: string | null }>({ topPerformingId: null, mostUsedId: null })

  const { register, getValues, formState: { isSubmitting, errors }, reset } = useForm<{ name: string }>({
    defaultValues: { name: "" }
  })

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const qs = new URLSearchParams({ start, end }).toString()
      const r = await fetch(`/api/strategies?${qs}`, { cache: "no-store" })
      if (!r.ok) throw new Error(await r.text())
      const data = await r.json() as { items: Row[]; summary: { topPerformingId: string|null; mostUsedId: string|null } }
      setItems(data.items)
      setSummary(data.summary)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load strategies")
    } finally {
      setLoading(false)
    }
  }, [start, end])

  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => {
    let arr = items
    const q = query.trim().toLowerCase()
    if (q) arr = arr.filter(i => (i.name ?? "").toLowerCase().includes(q))
    switch (sort) {
      case "az": return [...arr].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      case "za": return [...arr].sort((a, b) => (b.name ?? "").localeCompare(a.name ?? ""))
      default:   return [...arr].sort((a, b) => +new Date(b.date_created) - +new Date(a.date_created))
    }
  }, [items, query, sort])

  const [step, setStep] = useState<"list" | "edit">("list")
  const [rules, setRules] = useState<RuleRow[]>([])
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)

  function uid(): string {
  const maybeCrypto =
    typeof globalThis !== "undefined"
      ? ((globalThis as unknown as { crypto?: unknown }).crypto as
          | { randomUUID?: () => string }
          | undefined)
      : undefined

  if (typeof maybeCrypto?.randomUUID === "function") {
    return maybeCrypto.randomUUID()
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

  function openCreate() {
    setMode("create"); setEditingId(null)
    reset({ name: "" })
    setRules([])
    setSelectedRuleId(null)
    setStep("list")
    setOpen(true)
  }

  
  async function openEdit(row: Row) {
    setMode("edit"); setEditingId(row.id)
    reset({ name: row.name ?? "" })
    setSelectedRuleId(null)
    setStep("list")
    setOpen(true)

    try {
      const r = await fetch(`/api/strategies/${row.id}`, { cache: "no-store" })
      if (!r.ok) {
        const msg = await r.text()
        throw new Error(`Failed to load strategy: ${r.status} ${r.statusText} - ${msg}`)
      }
      const data: StrategyDetail = await r.json()

      setRules(
        (data.rules ?? []).map(rr => ({
          id: rr.id,
          title: rr.title,
          description: rr.description ?? null,
        }))
      )
    } catch (e) {
      console.error(e)
    }
  }

  const [editTitle, setEditTitle] = useState<string>("")
  const [editDesc, setEditDesc] = useState<string>("")

  useEffect(() => {
    if (step === "edit" && selectedRuleId) {
      const rr = rules.find(r => r.id === selectedRuleId)
      setEditTitle(rr?.title ?? "")
      setEditDesc(rr?.description ?? "")
    } else if (step === "edit") {
      setEditTitle("")
      setEditDesc("")
    }
  }, [step, selectedRuleId, rules])

  function addRule() {
    setSelectedRuleId(null)
    setStep("edit")
  }
  function editRule(id: string) {
    setSelectedRuleId(id)
    setStep("edit")
  }
  function deleteRule(id: string) {
    setRules(prev => prev.filter(r => r.id !== id))
    if (selectedRuleId === id) setSelectedRuleId(null)
  }
  function saveRule() {
    const title = editTitle.trim()
    if (!title) {
      return
    }
    if (selectedRuleId) {
      setRules(prev => prev.map(r => r.id === selectedRuleId ? { ...r, title, description: editDesc.trim() || null } : r))
    } else {
      const newId = uid()
      setRules(prev => [...prev, { id: newId, title, description: editDesc.trim() || null }])
    }
    setStep("list")
  }

  async function onSubmitNameAndRules() {
    const values = getValues()
    const payload = {
      name: values.name.trim(),
      rules: rules.map(r => ({
        title: r.title.trim(),
        description: (r.description ?? "").trim() || null,
      })),
    }

    if (!payload.name) return
    if (payload.rules.length < 1) return

    try {
      if (mode === "create") {
        const r = await fetch("/api/strategies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!r.ok) throw new Error(await r.text())
      } else {
        const r = await fetch(`/api/strategies/${editingId ?? ""}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!r.ok) throw new Error(await r.text())
      }
      setOpen(false)
      await load()
    } catch (e: unknown) {
      console.error(e)
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
      console.error(e)
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
              <div className="mt-2 text-2xl font-semibold">
                {(() => {
                  const it = items.find(i => i.id === summary.topPerformingId)
                  return it?.name ?? "N/A"
                })()}
              </div>
            </div>
            <div className="right-0 top-0 h-10 w-10 grid place-items-center rounded-full bg-yellow-400 text-white">👥</div>
          </div>
        </Card>

        <Card>
          <div className="flex justify-between">
            <div className="flex flex-col">
              <div className="text-sm text-gray-600">Most Used Strategy</div>
              <div className="mt-2 text-2xl font-semibold">
                {(() => {
                  const it = items.find(i => i.id === summary.mostUsedId)
                  return it?.name ?? "N/A"
                })()}
              </div>
            </div>
            <div className="right-0 top-0 h-10 w-10 grid place-items-center rounded-full bg-purple-500 text-white">👁️</div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-gray-600">Date range:</div>
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2"
          />
          <span className="text-gray-400">—</span>
          <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2"
          />
          <button
            className="rounded-xl bg-gray-100 px-3 py-2 text-sm"
            onClick={() => {
              const now = new Date()
              const s = new Date(new Date().setMonth(now.getMonth() - 6))
              setStart(s.toISOString().slice(0, 10))
              setEnd(now.toISOString().slice(0, 10))
            }}
          >
            Last 6 months
          </button>
          <button className="rounded-xl bg-white px-3 py-2 text-sm border" onClick={() => void load()}>
            Apply
          </button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
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
            <button onClick={() => setShowSearch((s: boolean) => !s)} className="p-2 rounded-full hover:bg-gray-100">🔍</button>

            <div className="relative">
              <button
                onClick={() => { setShowFilter((f: boolean) => !f); setShowMenu(false) }}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                🧰
              </button>
              {showFilter && (
                <div
                  className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-20"
                  onMouseLeave={() => setShowFilter(false)}
                >
                  <MenuItem label="Newest" onClick={() => { setSort("new"); setShowFilter(false) }} icon="🧾" />
                  <MenuItem label="From A-Z" onClick={() => { setSort("az"); setShowFilter(false) }} icon="🔤" />
                  <MenuItem label="From Z-A" onClick={() => { setSort("za"); setShowFilter(false) }} icon="🔠" />
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => { setShowMenu((m: boolean) => !m); setShowFilter(false) }}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                ⋯
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-20"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  <MenuItem label="Refresh" onClick={() => { void load(); setShowMenu(false) }} />
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
                    <td colSpan={6} className="py-12 text-center text-sm text-gray-500">No data</td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "Add Strategy" : "Edit Strategy"}
        footer={
          step === "list" ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
                onClick={addRule}
              >
                Add New Rule
              </button>
              <div className="flex items-center gap-3">
                <button className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200" onClick={() => setOpen(false)}>Cancel</button>
                <button
                  onClick={onSubmitNameAndRules}
                  disabled={isSubmitting}
                  className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {mode === "create" ? "Add Strategy" : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200" onClick={() => setStep("list")}>Back</button>
              <div className="flex items-center gap-3">
                {selectedRuleId && (
                  <button
                    className="rounded-xl bg-orange-600 text-white px-4 py-2 text-sm hover:opacity-90"
                    onClick={() => { if (selectedRuleId) deleteRule(selectedRuleId); setStep("list") }}
                  >
                    Delete
                  </button>
                )}
                <button className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm hover:opacity-90" onClick={saveRule}>
                  {selectedRuleId ? "Save" : "Add"}
                </button>
              </div>
            </div>
          )
        }
      >
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          {step === "list" ? (
            <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
              <div>
                <div className="text-sm mb-1">Strategy Name <span className="text-red-600">*</span></div>
                <input
                  {...register("name", { required: true })}
                  placeholder=""
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                />
                {"name" in errors && <div className="mt-1 text-xs text-red-600">Strategy Name is required</div>}
              </div>

              <div className="mt-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Rules</div>
                  <button type="button" className="rounded-xl bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200" onClick={addRule}>＋ Add rule</button>
                </div>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Rule Name</th>
                        <th className="text-left px-3 py-2">Description</th>
                        <th className="text-right px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.length ? rules.map(r => (
                        <tr key={r.id} className="border-t">
                          <td className="px-3 py-2">{r.title}</td>
                          <td className="px-3 py-2 text-gray-600">{r.description || "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2 justify-end">
                              <button type="button" className="text-gray-700 hover:underline" onClick={() => editRule(r.id)}>Edit</button>
                              <button type="button" className="text-orange-700 hover:underline" onClick={() => deleteRule(r.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={3} className="px-3 py-8 text-center text-gray-500">No rules yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </form>
          ) : (
            <div className="grid gap-4">
              <div>
                <div className="text-sm mb-1">Rule Name <span className="text-red-600">*</span></div>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="e.g. Break of structure on H1"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <div className="text-sm mb-1">Description</div>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  placeholder="Optional description..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}
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
