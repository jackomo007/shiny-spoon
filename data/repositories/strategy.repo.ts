import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

type StrategyWithRules = Prisma.strategyGetPayload<{
  include: { strategy_rules: { include: { rule: true } } }
}>

export type UpsertRule = { title: string; description?: string | null }

export const StrategyRepo = {
  listByAccountId(accountId: string) {
    return prisma.strategy.findMany({
      where: { account_id: accountId },
      orderBy: { date_created: "desc" },
      include: { strategy_rules: { include: { rule: true } } },
    })
  },

  listByUserPublicId(userPublicId: string) {
    return prisma.strategy.findMany({
      where: { account: { user: { public_id: userPublicId } } },
      orderBy: { date_created: "desc" },
      include: { strategy_rules: { include: { rule: true } } },
    })
  },

  async createWithRules(
    accountId: string,
    name: string,
    rules: UpsertRule[],
    notes?: string | null,
  ): Promise<StrategyWithRules> {
    const normalized = rules
      .map(r => ({ title: r.title.trim(), description: (r.description ?? "").trim() || null }))
      .filter(r => !!r.title)

    return prisma.$transaction(async (tx) => {
      const strategy = await tx.strategy.create({
        data: {
          account: { connect: { id: accountId } },
          name: name?.trim() || null,
          notes: (notes ?? "") || null,
        },
        include: { strategy_rules: { include: { rule: true } } },
      })

      for (const r of normalized) {
        const rule = await tx.rule.upsert({
          where: { title: r.title },
          create: { title: r.title, description: r.description },
          update: { description: r.description ?? undefined },
        })
        await tx.strategy_rule.create({
          data: { strategy_id: strategy.id, rule_id: rule.id },
        })
      }

      return tx.strategy.findUniqueOrThrow({
        where: { id: strategy.id },
        include: { strategy_rules: { include: { rule: true } } },
      })
    })
  },

  async updateWithRules(
    id: string,
    name: string,
    rules: UpsertRule[],
    notes?: string | null,
  ) {
    const normalized = rules
      .map(r => ({ title: r.title.trim(), description: (r.description ?? "").trim() || null }))
      .filter(r => !!r.title)

    return prisma.$transaction(async (tx) => {
      await tx.strategy.update({
        where: { id },
        data: { name: name?.trim() || null, notes: (notes ?? "") || null },
      })
      await tx.strategy_rule.deleteMany({ where: { strategy_id: id } })

      for (const r of normalized) {
        const rule = await tx.rule.upsert({
          where: { title: r.title },
          create: { title: r.title, description: r.description },
          update: { description: r.description ?? undefined },
        })
        await tx.strategy_rule.create({
          data: { strategy_id: id, rule_id: rule.id },
        })
      }

      return tx.strategy.findUniqueOrThrow({
        where: { id },
        include: { strategy_rules: { include: { rule: true } } },
      })
    })
  },

  remove(id: string) {
    return prisma.strategy.delete({ where: { id } })
  },
}
