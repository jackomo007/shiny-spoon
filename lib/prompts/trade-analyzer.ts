import "server-only"
import { getPrompt } from "@/lib/app-prompts"

export type PromptParams = {
  strategyName?: string | null;
  strategyRules: Array<{ title: string; description?: string | null }>;
  asset: string;
  tradeType: "spot" | "futures";
  side: "buy" | "sell" | "long" | "short";
  amountSpent: number;
  entry: number;
  target?: number | null;
  stop?: number | null;
  timeframe: string;
};

export async function buildTradeAnalyzerPrompt(p: PromptParams) {
  const rr =
    p.target != null && p.stop != null && p.entry !== p.stop
      ? Math.abs((p.target - p.entry) / (p.entry - p.stop))
      : null;

  const rulesBlock = p.strategyRules.length
    ? p.strategyRules
        .map((r, i) => ` ${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ""}`)
        .join("\n")
    : " (no rules provided)";

  const tpl = await getPrompt("trade_analyzer_template")
  return tpl
    .replace("{{strategyName}}", p.strategyName || "—")
    .replace("{{strategyRules}}", rulesBlock)
    .replace("{{asset}}", p.asset)
    .replace("{{timeframe}}", p.timeframe.toUpperCase())
    .replace("{{tradeType}}", p.tradeType.toUpperCase())
    .replace("{{side}}", p.side.toUpperCase())
    .replace("{{amountSpent}}", String(p.amountSpent))
    .replace("{{entry}}", String(p.entry))
    .replace("{{target}}", String(p.target ?? "—"))
    .replace("{{stop}}", String(p.stop ?? "—"))
    .replace("{{rr}}", rr != null ? `${rr.toFixed(2)}R` : "R:R not estimable")
}
