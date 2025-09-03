import { StrategyRepo, type UpsertRule } from "@/data/repositories/strategy.repo";

type RuleInput = string[] | UpsertRule[];

function toUpsertRules(rules: RuleInput): UpsertRule[] {
  return (rules as (string | UpsertRule)[]).map((r) =>
    typeof r === "string"
      ? { title: r, description: null }
      : { title: r.title.trim(), description: (r.description ?? null) }
  );
}

export const StrategyService = {
  list(accountId: string) {
    return StrategyRepo.listByAccountId(accountId);
  },

  create(accountId: string, name: string, rules: RuleInput) {
    const normalized = toUpsertRules(rules);
    return StrategyRepo.createWithRules(accountId, name, normalized);
  },

  update(id: string, name: string, rules: RuleInput) {
    const normalized = toUpsertRules(rules);
    return StrategyRepo.updateWithRules(id, name, normalized);
  },

  remove(id: string) {
    return StrategyRepo.remove(id);
  },
};
