"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type T = "crypto" | "stock" | "forex"

export default function RegisterPage() {
  const r = useRouter()
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [types, setTypes] = useState<T[]>(["crypto"])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function toggle(t: T) {
    if (t === "crypto") return
    setTypes((prev) =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, types }),
      })
      if (!res.ok) throw new Error(await res.text())
      
      r.push("/login")
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setLoading(false)
    }
  }

  const Card = ({ t, locked = false }: { t: T; locked?: boolean }) => {
    const active = types.includes(t)
    return (
      <button
        type="button"
        disabled={locked}
        onClick={() => toggle(t)}
        className={`rounded-2xl border p-4 text-left hover:bg-gray-50 ${active ? "border-primary" : "border-gray-200"} ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <div className="text-sm text-gray-500">{t.toUpperCase()}</div>
        <div className="mt-1 font-semibold">
          {t === "crypto" ? "Crypto (default)" : t === "stock" ? "Stock" : "Forex"}
        </div>
        <div className="mt-2">
          <input type="checkbox" readOnly checked={active} />{" "}
          <span className="text-sm">{locked ? "Always on" : "Enable"}</span>
        </div>
      </button>
    )
  }

  return (
    <div className="mx-auto max-w-md py-10 px-4">
      <h1 className="text-2xl font-semibold mb-6">Create your account</h1>

      <form className="grid gap-4" onSubmit={onSubmit}>
        <input className="rounded-xl border p-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="rounded-xl border p-2" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="rounded-xl border p-2" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />

        <div className="mt-2">
          <div className="text-sm mb-2">Account types</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card t="crypto" locked />
            <Card t="stock" />
            <Card t="forex" />
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <button disabled={loading} className="rounded-xl bg-primary text-white px-4 py-2 disabled:opacity-50">
          {loading ? "Creating…" : "Create account"}
        </button>
          <p className="mt-4 text-sm text-neutral-600">
          Already have an account? <a className="text-violet-700 underline" href="/login">Login</a>
        </p>
      </form>
    </div>
  )
}
