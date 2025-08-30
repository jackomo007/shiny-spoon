import { StrategyRepo } from "@/data/repositories/strategy.repo"

export const StrategyService = {
  list(accountId: string) { return StrategyRepo.listByAccountId(accountId) },
  create(accountId: string, name: string, rules: string[]) { return StrategyRepo.createWithRules(accountId, name, rules) },
  update(id: string, name: string, rules: string[]) { return StrategyRepo.updateWithRules(id, name, rules) },
  remove(id: string) { return StrategyRepo.remove(id) },
}
