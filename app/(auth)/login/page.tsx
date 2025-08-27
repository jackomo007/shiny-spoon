"use client"

import { Suspense, FormEvent, useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"

function LoginInner() {
  const sp = useSearchParams()
  const cbError = sp.get("error") // e.g. "CredentialsSignin"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    // Let NextAuth handle the redirect
    await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/dashboard",
    })
  }

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm border border-neutral-200">
        <h1 className="mb-4 text-xl font-semibold">Login</h1>

        <div className="mb-3">
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email" required
            value={email} onChange={e => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password" required
            value={password} onChange={e => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {(error || cbError) && (
          <p className="mb-3 text-sm text-red-600">
            {error || (cbError === "CredentialsSignin" ? "Invalid credentials" : "Sign-in failed")}
          </p>
        )}

        <button className="w-full rounded-lg bg-violet-600 py-2 text-white hover:bg-violet-700">Sign in</button>

        <p className="mt-4 text-sm text-neutral-600">
          Don’t have an account? <a className="text-violet-700 underline" href="/register">Create one</a>
        </p>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center">Loading…</div>}>
      <LoginInner />
    </Suspense>
  )
}

