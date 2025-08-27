import { StrategyRepo } from "@/data/repositories/strategy.repo"

export const StrategyService = {
  list(userPublicId: string) { return StrategyRepo.listByUserPublicId(userPublicId) },
  create(userPublicId: string, name: string, rules: string[]) { return StrategyRepo.createWithRules(userPublicId, name, rules) },
  update(id: string, name: string, rules: string[]) { return StrategyRepo.updateWithRules(id, name, rules) },
  remove(id: string) { return StrategyRepo.remove(id) },
}
