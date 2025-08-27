import { prisma } from "@/lib/prisma"

export const StrategyRepo = {
  listByUserPublicId(userPublicId: string) {
    return prisma.strategy.findMany({
      where: { user_id: userPublicId },
      orderBy: { date_created: "desc" },
      include: {
        strategy_rules: { include: { rule: true } },
      },
    })
  },

  async createWithRules(userPublicId: string, name: string, rules: string[]) {
    const normalized = rules.map(r => r.trim().toLowerCase()).filter(Boolean)
    return prisma.$transaction(async (tx) => {
      const data: any = { user_id: userPublicId }
      if (name && name.trim()) data.name = name.trim()

      const strategy = await tx.strategy.create({ data })

      for (const raw of normalized) {
        let rule = await tx.rule.findUnique({ where: { normalized: raw } })
        if (!rule) {
          rule = await tx.rule.create({ data: { raw_input: raw, normalized: raw } })
        }
        await tx.strategy_rule.create({
          data: { strategy_id: strategy.id, rule_id: rule.id }
        })
      }
      return strategy
    })
  },

  async updateWithRules(id: string, name: string, rules: string[]) {
    const normalized = rules.map(r => r.trim().toLowerCase()).filter(Boolean)
    return prisma.$transaction(async (tx) => {
      const data: any = {}
      if (name && name.trim()) data.name = name.trim()
      else data.name = null // se quiser permitir limpar o nome

      await tx.strategy.update({ where: { id }, data })
      await tx.strategy_rule.deleteMany({ where: { strategy_id: id } })

      for (const raw of normalized) {
        let rule = await tx.rule.findUnique({ where: { normalized: raw } })
        if (!rule) {
          rule = await tx.rule.create({ data: { raw_input: raw, normalized: raw } })
        }
        await tx.strategy_rule.create({ data: { strategy_id: id, rule_id: rule.id } })
      }
    })
  },

  remove(id: string) {
    return prisma.strategy.delete({ where: { id } })
  },
}
