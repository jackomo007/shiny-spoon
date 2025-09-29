import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { listPrompts, setPrompt } from "@/lib/app-prompts"
import { z } from "zod"

const PutSchema = z.object({
  items: z.array(z.object({
    key: z.enum(["chart_analysis_system","trade_analyzer_system","trade_analyzer_template"]),
    content: z.string().min(1),
  }))
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const rows = await listPrompts()
  return NextResponse.json({ items: rows })
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin || !session.user?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const parsed = PutSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const uid = Number(session.user.id)
  for (const it of parsed.data.items) {
    await setPrompt(it.key, it.content, uid)
  }
  return NextResponse.json({ ok: true })
}
