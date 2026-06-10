"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import Card from "@/components/ui/Card"
import Modal from "@/components/ui/Modal"
import { Table, Td, Th, Tr } from "@/components/ui/Table"

type Row = {
  id: string
  name: string
  description: string | null
  color: string
  date_created: string | Date
  tradesUsed: number
  winRate: number
  avgRR: string | null
  pnl: number
}

type Summary = {
  topPerformingId: string | null
  mostUsedId: string | null
}

type FormValues = {
  name: string
  description: string
  color: string
}

function buildRangeQS(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T23:59:59.999`)
  return new URLSearchParams({
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  }).toString()
}

function randomTagColor() {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")}`.toUpperCase()
}

export default function ManageTagsClient() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary>({
    topPerformingId: null,
    mostUsedId: null,
  })
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"new" | "az" | "za">("new")
  const [showFilter, setShowFilter] = useState(false)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [start, setStart] = useState(() => {
    const end = new Date()
    const s = new Date(new Date().setMonth(end.getMonth() - 6))
    return s.toISOString().slice(0, 10)
  })
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10))

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { name: "", description: "", color: "#7C3AED" },
  })

  const color = watch("color")

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const qs = buildRangeQS(start, end)
      const res = await fetch(`/api/tags?${qs}`, { cache: "no-store" })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { items: Row[]; summary: Summary }
      setItems(data.items)
      setSummary(data.summary)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tags")
    } finally {
      setLoading(false)
    }
  }, [start, end])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    let arr = items
    const q = query.trim().toLowerCase()
    if (q) {
      arr = arr.filter((item) => {
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description ?? "").toLowerCase().includes(q)
        )
      })
    }

    switch (sort) {
      case "az":
        return [...arr].sort((a, b) => a.name.localeCompare(b.name))
      case "za":
        return [...arr].sort((a, b) => b.name.localeCompare(a.name))
      default:
        return [...arr].sort(
          (a, b) => +new Date(b.date_created) - +new Date(a.date_created),
        )
    }
  }, [items, query, sort])

  function resetToLast6Months() {
    const now = new Date()
    const s = new Date(new Date().setMonth(now.getMonth() - 6))
    setStart(s.toISOString().slice(0, 10))
    setEnd(now.toISOString().slice(0, 10))
  }

  function openCreate() {
    setMode("create")
    setEditingId(null)
    reset({ name: "", description: "", color: randomTagColor() })
    setOpen(true)
  }

  function openEdit(row: Row) {
    setMode("edit")
    setEditingId(row.id)
    reset({
      name: row.name,
      description: row.description ?? "",
      color: row.color || "#7C3AED",
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      color: values.color,
    }

    const res =
      mode === "create"
        ? await fetch("/api/tags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/tags/${editingId ?? ""}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

    if (!res.ok) throw new Error(await res.text())
    setOpen(false)
    await load()
  }

  async function confirmDelete() {
    if (!deleteId) return
    try {
      setDeleting(true)
      const res = await fetch(`/api/tags/${deleteId}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
      setConfirmOpen(false)
      setDeleteId(null)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  const topPerforming = items.find((item) => item.id === summary.topPerformingId)
  const mostUsed = items.find((item) => item.id === summary.mostUsedId)

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={openCreate}
          className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
        >
          + Add Tag
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <div className="flex justify-between gap-4">
            <div>
              <div className="text-sm text-gray-600">Top Performing Tag</div>
              <div className="mt-2 text-2xl font-semibold">
                {topPerforming?.name ?? "N/A"}
              </div>
            </div>
            <span
              className="h-10 w-10 rounded-full"
              style={{ backgroundColor: topPerforming?.color ?? "#FBBF24" }}
            />
          </div>
        </Card>

        <Card>
          <div className="flex justify-between gap-4">
            <div>
              <div className="text-sm text-gray-600">Most Used Tag</div>
              <div className="mt-2 text-2xl font-semibold">
                {mostUsed?.name ?? "N/A"}
              </div>
            </div>
            <span
              className="h-10 w-10 rounded-full"
              style={{ backgroundColor: mostUsed?.color ?? "#8B5CF6" }}
            />
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-gray-600">Date range:</div>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2"
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2"
          />
          <button
            className="rounded-xl border bg-white px-3 py-2 text-sm"
            onClick={() => void load()}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={resetToLast6Months}
            className="rounded-xl bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
          >
            Reset
          </button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {showSearch && (
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="text-gray-400">Search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type and hit enter ..."
                className="flex-1 bg-transparent text-gray-700 outline-none placeholder:text-gray-400"
              />
              <button
                onClick={() => setShowSearch(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                x
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <h3 className="text-base font-semibold text-gray-800">Manage Tags</h3>
          <div className="relative flex items-center gap-3">
            <button
              onClick={() => setShowSearch((current) => !current)}
              className="rounded-full p-2 hover:bg-gray-100"
            >
              Search
            </button>
            <button
              onClick={() => setShowFilter((current) => !current)}
              className="rounded-full p-2 hover:bg-gray-100"
            >
              Sort
            </button>
            {showFilter && (
              <div
                className="absolute right-0 top-10 z-20 w-44 rounded-xl bg-white shadow-lg ring-1 ring-black/5"
                onMouseLeave={() => setShowFilter(false)}
              >
                <MenuItem label="Newest" onClick={() => { setSort("new"); setShowFilter(false) }} />
                <MenuItem label="From A-Z" onClick={() => { setSort("az"); setShowFilter(false) }} />
                <MenuItem label="From Z-A" onClick={() => { setSort("za"); setShowFilter(false) }} />
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-2">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">Loading...</div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-red-600">{error}</div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Description</Th>
                  <Th>Trades Used</Th>
                  <Th>Win Rate</Th>
                  <Th>Average R:R</Th>
                  <Th>Total PNL</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                          <span>{row.name}</span>
                        </div>
                      </Td>
                      <Td>{row.description || "-"}</Td>
                      <Td>{row.tradesUsed}</Td>
                      <Td>{row.winRate}%</Td>
                      <Td>{row.avgRR}</Td>
                      <Td>${row.pnl}</Td>
                      <Td>
                        <div className="flex justify-end gap-3">
                          <button
                            title="Edit"
                            onClick={() => openEdit(row)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            Edit
                          </button>
                          <button
                            title="Delete"
                            onClick={() => {
                              setDeleteId(row.id)
                              setConfirmOpen(true)
                            }}
                            className="text-orange-600 hover:text-orange-700"
                          >
                            Delete
                          </button>
                        </div>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                      No data
                    </td>
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
        title={mode === "create" ? "Add Tag" : "Edit Tag"}
        widthClass="max-w-xl"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit((values) => void onSubmit(values))}
              disabled={isSubmitting}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {mode === "create" ? "Add Tag" : "Save Changes"}
            </button>
          </div>
        }
      >
        <form className="grid gap-4" onSubmit={(event) => event.preventDefault()}>
          <div>
            <div className="mb-1 text-sm">
              Tag Name <span className="text-red-600">*</span>
            </div>
            <input
              {...register("name", { required: "Tag Name is required" })}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
            />
            {errors.name && (
              <div className="mt-1 text-xs text-red-600">
                {String(errors.name.message)}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 text-sm">Tag Description</div>
            <textarea
              {...register("description")}
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <div className="mb-1 text-sm">
              Tag Color <span className="text-red-600">*</span>
            </div>
            <div className="grid gap-3">
              <input
                type="color"
                value={color}
                onChange={(event) => {
                  setValue("color", event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }}
                className="h-10 w-14 rounded-xl border border-gray-200 bg-white p-1"
              />
              <input
                type="hidden"
                {...register("color", {
                  required: "Tag Color is required",
                  pattern: {
                    value: /^#[0-9A-Fa-f]{6}$/,
                    message: "Use a valid color",
                  },
                })}
              />
              <div className="flex items-center gap-3">
                <span
                  className="h-8 w-8 rounded-full border border-gray-200"
                  style={{ backgroundColor: color }}
                />
                <span className="font-mono text-sm text-gray-600">{color.toUpperCase()}</span>
              </div>
            </div>
            {errors.color && (
              <div className="mt-1 text-xs text-red-600">
                {String(errors.color.message)}
              </div>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete Tag?"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-orange-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          This will remove the tag from existing trades and delete it from your tag list.
        </p>
      </Modal>
    </div>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
