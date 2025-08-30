import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

type StrategyWithRules = Prisma.strategyGetPayload<{
  include: { strategy_rules: { include: { rule: true } } }
}>

export const StrategyRepo = {
  listByAccountId(accountId: string) {
    return prisma.strategy.findMany({
      where: { account_id: accountId },
      orderBy: { date_created: "desc" },
      include: {
        strategy_rules: { include: { rule: true } },
      },
    })
  },

  
  listByUserPublicId(userPublicId: string) {
    return prisma.strategy.findMany({
      where: {
        account: {
          user: { public_id: userPublicId },
        },
      },
      orderBy: { date_created: "desc" },
      include: {
        strategy_rules: { include: { rule: true } },
      },
    })
  },

  async createWithRules(
    accountId: string,
    name: string,
    rules: string[]
  ): Promise<StrategyWithRules> {
    const normalized = rules
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean)

    return prisma.$transaction(async (tx) => {
      const strategy = await tx.strategy.create({
        data: {
          account: { connect: { id: accountId } },
          name: name?.trim() || null,
        },
        include: {
          strategy_rules: { include: { rule: true } },
        },
      })

      for (const raw of normalized) {
        const rule = await tx.rule.upsert({
          where: { normalized: raw },
          create: { raw_input: raw, normalized: raw },
          update: {},
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

  async updateWithRules(id: string, name: string, rules: string[]) {
    const normalized = rules
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean)

    return prisma.$transaction(async (tx) => {
      await tx.strategy.update({
        where: { id },
        data: { name: name?.trim() || null },
      })

      await tx.strategy_rule.deleteMany({ where: { strategy_id: id } })

      for (const raw of normalized) {
        const rule = await tx.rule.upsert({
          where: { normalized: raw },
          create: { raw_input: raw, normalized: raw },
          update: {},
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
