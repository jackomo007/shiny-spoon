import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth" 
import { prisma } from "@/lib/prisma" 

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json([], { status: 200 })
  const userPublicId = String(session.user.id)

  const list = await prisma.strategy.findMany({
    where: { user_id: userPublicId },
    orderBy: { date_created: "desc" },
    include: { strategy_rules: { include: { rule: true } } },
  })

  const mapped = list.map(s => ({
    id: s.id,
    name: s.name,
    date_created: s.date_created ?? new Date(),
    rules: s.strategy_rules.map(sr => sr.rule.raw_input),
  }))
  return NextResponse.json(mapped)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userPublicId = String(session.user.id)

  const { name, rules } = await req.json() as { name: string, rules: string[] }
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const created = await prisma.strategy.create({
    data: { name, user_id: userPublicId }
  })

  for (const raw of (rules ?? [])) {
    const normalized = raw.trim().toLowerCase()
    if (!normalized) continue
    const rule = await prisma.rule.upsert({
      where: { normalized },
      update: {},
      create: { raw_input: raw.trim(), normalized }
    })
    await prisma.strategy_rule.create({
      data: { strategy_id: created.id, rule_id: rule.id }
    })
  }

  return NextResponse.json({ id: created.id })
}
