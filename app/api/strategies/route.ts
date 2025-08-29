import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { getActiveAccountId } from "@/lib/account"

const UpsertSchema = z.object({
  name: z.string().min(1),
  rules: z.array(z.string()).default([]),
})

function normalizeRule(s: string) {
  return s.trim().toLowerCase()
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)

  const rows = await prisma.strategy.findMany({
    where: { account_id: accountId },
    orderBy: { date_created: "desc" },
    include: {
      strategy_rules: { include: { rule: true } },
    },
  })

  const items = rows.map(r => ({
    id: r.id,
    name: r.name,
    date_created: r.date_created!,
    rules: r.strategy_rules.map(sr => sr.rule.raw_input),
  }))

  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)

  const { name, rules } = parsed.data
  const created = await prisma.$transaction(async (tx) => {
    const st = await tx.strategy.create({
      data: { name, account_id: accountId },
    })

    for (const raw of rules.map(r => r.trim()).filter(Boolean)) {
      const norm = normalizeRule(raw)
      const r = await tx.rule.upsert({
        where: { normalized: norm },
        update: {},
        create: { raw_input: raw, normalized: norm },
      })
      await tx.strategy_rule.create({
        data: { strategy_id: st.id, rule_id: r.id },
      })
    }

    return st
  })

  return NextResponse.json({ id: created.id })
}
