import "server-only"
import { prisma } from "@/lib/prisma"

export type PromptKey =
  | "chart_analysis_system"
  | "trade_analyzer_system"
  | "trade_analyzer_template"
  | "price_structure_system"
  | "price_structure_template"

const DEFAULTS: Record<PromptKey, { title: string; description?: string; content: string }> = {
  chart_analysis_system: {
    title: "System — Chart Analysis",
    content: "You are a professional crypto market analyst. Focus only on the chart image.",
  },
  trade_analyzer_system: {
    title: "System — Trade Analyzer",
    content:
      "You're a senior market analyst. Be objective, avoid unexplained jargon, and always detail risks.",
  },
  trade_analyzer_template: {
    title: "User Template — Trade Analyzer",
    content:
`Analyze the following trade **strictly** based on the attached chart and the inputs below.
Be specific about trend context, liquidity/SR zones, volatility, exhaustion/continuation signals, and any confluences.

Trade inputs:
- Strategy: {{strategyName}}
- Strategy rules:
{{strategyRules}}
- Asset: {{asset}}
- Timeframe: {{timeframe}}
- Type: {{tradeType}}
- Side: {{side}}
- Amount Spent / Risk Capital: {{amountSpent}}
- Entry: {{entry}}
- Target (TP): {{target}}
- Stop: {{stop}}
- Estimated Risk:Reward: {{rr}}

Answer in concise bullet points:
1) Price context (trend, structure, key levels visible on the chart).
2) Confluences vs. the listed rules (which rules apply and why).
3) Risk assessment (volatility, distance to stop, likely drawdown).
4) Setup quality (strong/medium/weak) and **clear invalidation conditions**.
5) Trade plan: entry execution, stop management (trailing/BE), partials, and whether to keep/adjust the TP.
6) Alternatives (e.g., wait for a close beyond a level, use a different TF, or skip the trade).
`.trim(),
  },

  price_structure_system: {
    title: "System — Price Structure (HTF SR)",
    content: `
You are a professional swing trader.
Your job is to identify the **top 3 high timeframe support and resistance levels** for a given crypto pair.

Constraints:
- Focus on daily or higher timeframes (1D+, ideally 1D / 3D / 1W).
- Be objective and consistent.
- Use ONLY the information provided (symbol, timeframe, current price, and any chart context if present).
- When in doubt, still return 3 supports and 3 resistances that make technical sense.
- Output MUST be valid JSON — no extra commentary.
`.trim(),
  },

  price_structure_template: {
    title: "User Template — Price Structure (HTF SR)",
    content: `
Analyze the high timeframe ({{timeframe}}) price structure for {{asset}}.

Return ONLY a JSON object with this exact shape:

{
  "supports": [
    {
      "level": number,
      "kind": "support",
      "label": string,
      "confidence": number,
      "notes": string
    }
  ],
  "resistances": [
    {
      "level": number,
      "kind": "resistance",
      "label": string,
      "confidence": number,
      "notes": string
    }
  ]
}

Rules:
- Always return EXACTLY 3 supports and EXACTLY 3 resistances.
- "confidence" is an integer from 1 to 5.
- "label" is a short description of the level (e.g. "Weekly swing low", "Daily supply zone").
- "notes" briefly explain **why** this level matters.
- Levels should be ordered from closest to current price to furthest away.
- All "level" values must be positive numbers, in the same price units as the asset.
`.trim(),
  },
};

export async function getPrompt(key: PromptKey): Promise<string> {
  const row = await prisma.app_prompt.findUnique({ where: { key } })
  if (row?.content) return row.content
  const d = DEFAULTS[key]
  await prisma.app_prompt.upsert({
    where: { key },
    update: {},
    create: { key, title: d.title, description: d.description ?? null, content: d.content },
  })
  return d.content
}

export async function listPrompts() {
  const rows = await prisma.app_prompt.findMany({ orderBy: { key: "asc" } })
  const keys = Object.keys(DEFAULTS) as PromptKey[]
  for (const k of keys) {
    if (!rows.find(r => r.key === k)) await getPrompt(k)
  }
  return prisma.app_prompt.findMany({ orderBy: { key: "asc" } })
}

export async function setPrompt(key: PromptKey, content: string, updatedBy: number) {
  return prisma.app_prompt.upsert({
    where: { key },
    update: { content, updated_by: updatedBy },
    create: {
      key,
      title: DEFAULTS[key]?.title ?? key,
      description: DEFAULTS[key]?.description ?? null,
      content,
      updated_by: updatedBy,
    },
  })
}
