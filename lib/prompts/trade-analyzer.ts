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

export function buildTradeAnalyzerPrompt(p: PromptParams) {
  const rr =
    p.target != null && p.stop != null && p.entry !== p.stop
      ? Math.abs((p.target - p.entry) / (p.entry - p.stop))
      : null;

  const rulesBlock = p.strategyRules.length
    ? p.strategyRules
        .map((r, i) => ` ${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ""}`)
        .join("\n")
    : " (no rules provided)";

  return [
    `Analyze the following trade **strictly** based on the attached chart and the inputs below.`,
    `Be specific about trend context, liquidity/SR zones, volatility, exhaustion/continuation signals, and any confluences.`,
    ``,
    `Trade inputs:`,
    `- Strategy: ${p.strategyName || "—"}`,
    `- Strategy rules:${rulesBlock}`,
    `- Asset: ${p.asset}`,
    `- Timeframe: ${p.timeframe.toUpperCase()}`,
    `- Type: ${p.tradeType.toUpperCase()}`,
    `- Side: ${p.side.toUpperCase()}`,
    `- Amount Spent / Risk Capital: ${p.amountSpent}`,
    `- Entry: ${p.entry}`,
    `- Target (TP): ${p.target ?? "—"}`,
    `- Stop: ${p.stop ?? "—"}`,
    `${rr != null ? `- Estimated Risk:Reward: ${rr.toFixed(2)}R` : `- R:R not estimable (missing TP/SL or invalid values)`}`,
    ``,
    `Answer in concise bullet points:`,
    `1) Price context (trend, structure, key levels visible on the chart).`,
    `2) Confluences vs. the listed rules (which rules apply and why).`,
    `3) Risk assessment (volatility, distance to stop, likely drawdown).`,
    `4) Setup quality (strong/medium/weak) and **clear invalidation conditions**.`,
    `5) Trade plan: entry execution, stop management (trailing/BE), partials, and whether to keep/adjust the TP.`,
    `6) Alternatives (e.g., wait for a close beyond a level, use a different TF, or skip the trade).`,
  ].join("\n");
}
