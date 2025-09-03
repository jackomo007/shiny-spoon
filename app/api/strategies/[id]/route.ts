import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getActiveAccountId } from "@/lib/account";

const UpsertSchema = z.object({
  name: z.string().min(1),
  rules: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional().nullable(),
      })
    )
    .default([]),
});

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const userId = Number(session.user.id);
  const accountId = await getActiveAccountId(userId);
  if (!accountId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const st = await prisma.strategy.findFirst({
    where: { id, account_id: accountId },
    include: { strategy_rules: { include: { rule: true } } },
  });

  if (!st) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: st.id,
    name: st.name,
    date_created: st.date_created,
    rules: st.strategy_rules.map((sr) => ({
      id: sr.rule.id,
      title: sr.rule.title,
      description: sr.rule.description,
    })),
  });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const userId = Number(session.user.id);
  const accountId = await getActiveAccountId(userId);
  if (!accountId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const exists = await prisma.strategy.findFirst({
    where: { id, account_id: accountId },
  });
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { name, rules } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.strategy.update({ where: { id }, data: { name } });
    await tx.strategy_rule.deleteMany({ where: { strategy_id: id } });

    for (const { title, description } of rules) {
      const t = title.trim();
      if (!t) continue;
      const desc = (description ?? "").trim() || null;

      const rule = await tx.rule.upsert({
        where: { title: t },
        update: { description: desc ?? undefined },
        create: { title: t, description: desc },
      });

      await tx.strategy_rule.create({
        data: { strategy_id: id, rule_id: rule.id },
      });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const userId = Number(session.user.id);
  const accountId = await getActiveAccountId(userId);
  if (!accountId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const exists = await prisma.strategy.findFirst({
    where: { id, account_id: accountId },
  });
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.strategy.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
