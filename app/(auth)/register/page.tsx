"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password })
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || "Erro ao registrar")
      return
    }
    router.push("/login")
  }

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm border border-neutral-200">
        <h1 className="mb-4 text-xl font-semibold">Register</h1>
        <div className="mb-3">
          <label className="block text-sm mb-1">Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)}
                 className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
                 type="email" required />
        </div>
        <div className="mb-3">
          <label className="block text-sm mb-1">Username</label>
          <input value={username} onChange={e=>setUsername(e.target.value)}
                 className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
                 required />
        </div>
        <div className="mb-4">
          <label className="block text-sm mb-1">Password</label>
          <input value={password} onChange={e=>setPassword(e.target.value)}
                 className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
                 type="password" minLength={6} required />
        </div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-lg bg-violet-600 py-2 text-white hover:bg-violet-700">Criar conta</button>
        <p className="mt-4 text-sm text-neutral-600">
          Já tem conta? <a className="text-violet-700 underline" href="/login">Entrar</a>
        </p>
      </form>
    </div>
  )
}
