const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  const accounts = await prisma.account.findMany({ select: { id: true } })

  for (const a of accounts) {
    const hasNone = await prisma.strategy.findFirst({
      where: {
        account_id: a.id,
        name: { in: ["None", "none", "NONE"] },
      },
      select: { id: true },
    })
    if (!hasNone) {
      await prisma.strategy.create({
        data: { account_id: a.id, name: "None" },
      })
    }
  }

  const allNones = await prisma.strategy.findMany({
    where: { name: { in: ["None", "none", "NONE"] } },
    select: { id: true, account_id: true },
  })
  const noneByAccount = new Map(allNones.map(s => [s.account_id, s.id]))

  const portfolios = await prisma.strategy.findMany({
    where: { name: { in: ["Portfolio", "portfolio", "PORTFOLIO"] } },
    select: { id: true, account_id: true },
  })

  for (const sp of portfolios) {
    const noneId = noneByAccount.get(sp.account_id)
    if (!noneId) continue
    await prisma.journal_entry.updateMany({
      where: { strategy_id: sp.id },
      data: { strategy_id: noneId },
    })
  }

  await prisma.strategy.deleteMany({
    where: { name: { in: ["Portfolio", "portfolio", "PORTFOLIO"] } },
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    return prisma.$disconnect().finally(() => process.exit(1))
  })
