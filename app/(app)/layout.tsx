"use client"

import DashboardShell from "@/components/layout/DashboardShell"
import { SessionProvider } from "next-auth/react"

export default function AppAuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DashboardShell>{children}</DashboardShell>
    </SessionProvider>
  )
}
