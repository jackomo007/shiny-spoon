export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { id: string }

export async function GET(_req: Request, { params }: { params: Promise<Params> }) {
  const { id } = await params
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    include: { strategy_rules: { include: { rule: true } } },
  })
  if (!strategy) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(strategy)
}

export async function PUT(req: Request, { params }: { params: Promise<Params> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = (await req.json()) as { name: string; rules?: string[] }

  await prisma.strategy.update({
    where: { id },
    data: { name: body.name },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<Params> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.strategy.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
