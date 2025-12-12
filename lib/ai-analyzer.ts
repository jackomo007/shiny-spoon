import OpenAI from "openai";
import { getPrompt } from "@/lib/app-prompts";
import type {
  ChatCompletionContentPart,
  ChatCompletionContentPartText,
  ChatCompletionContentPartImage,
} from "openai/resources/chat/completions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type Usage = { input: number; output: number };

function textPart(text: string): ChatCompletionContentPartText {
  return { type: "text", text };
}

function imagePart(url: string): ChatCompletionContentPartImage {
  return { type: "image_url", image_url: { url } };
}

type OverlaySnapshot = {
  symbol: string;
  exchange: string;
  timeframe: string;
  priceClose: number;
  priceDiff: number;
  pricePct: number;
  high: number;
  low: number;
  volumeLast: number;
  avgVol30: number;
  createdAt: string;
};

type ChartContext = {
  overlay?: OverlaySnapshot;
  rightAxisTicks?: number[];
  plot?: { padding: number; heightPx: number };
};

export async function analyzeChartImage(imageUrl: string, ctx?: ChartContext) {
  const systemPrompt = await getPrompt("chart_analysis_system");
  const userText =
    "Analyze this chart. Use the structured data below for precise prices and stats. If the image and data disagree, prefer the data.";
  const model = process.env.CHART_ANALYZER_MODEL ?? "gpt-4o-mini";
  
  const structured = ctx ? JSON.stringify(ctx, null, 2) : "{}";

  const userContent: ChatCompletionContentPart[] = [
    textPart(userText),
    textPart("```json\n" + structured + "\n```"),
    imagePart(imageUrl),
  ];

  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
  });

  const usage: Usage = {
    input: res.usage?.prompt_tokens ?? 0,
    output: res.usage?.completion_tokens ?? 0,
  };

  return {
    text: res.choices[0]?.message?.content?.trim() || "No analysis.",
    model,
    prompt: userText,
    usage,
  };
}

export async function analyzeTradeText({
  prompt,
  model,
}: {
  prompt: string;
  model?: string;
}) {
  const systemPrompt = await getPrompt("trade_analyzer_system");
  const usedModel = model ?? (process.env.TRADE_ANALYZER_MODEL ?? "gpt-4o-mini");

  const res = await openai.chat.completions.create({
    model: usedModel,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  });

  const text = res.choices[0]?.message?.content?.trim() || "No analysis.";
  const usage: Usage = {
    input: res.usage?.prompt_tokens ?? 0,
    output: res.usage?.completion_tokens ?? 0,
  };

  return { text, model: usedModel, prompt, usage };
}

export async function analyzePriceStructure({
  asset,
  timeframe,
  lastPrice,
  prompt,
  model,
}: {
  asset: string;
  timeframe: string;
  lastPrice: number;
  prompt: string;
  model?: string;
}) {
  const systemPrompt = await getPrompt("price_structure_system");
  const usedModel = model ?? (process.env.PRICE_STRUCTURE_MODEL ?? "gpt-4o-mini");

  const res = await openai.chat.completions.create({
    model: usedModel,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  });

  const raw = res.choices[0]?.message?.content?.trim() ?? "{}";

  const usage: Usage = {
    input: res.usage?.prompt_tokens ?? 0,
    output: res.usage?.completion_tokens ?? 0,
  };

  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    json = match ? JSON.parse(match[0]) : { supports: [], resistances: [] };
  }

  return {
    json,
    raw,
    model: usedModel,
    usage,
  };
}
