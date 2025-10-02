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

export async function analyzeChartImage(imageUrl: string) {
  const systemPrompt = await getPrompt("chart_analysis_system");
  const userText = "Analyze this chart and tell me what's happening.";
  const model = process.env.CHART_ANALYZER_MODEL ?? "gpt-4o-mini";

  const userContent: ChatCompletionContentPart[] = [
    textPart(userText),
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

export async function analyzeTradeWithChart(args: {
  imageUrl: string;
  prompt: string;
  model?: string;
}) {
  const model = args.model ?? (process.env.TRADE_ANALYZER_MODEL ?? "gpt-4o-mini");
  const systemPrompt = await getPrompt("trade_analyzer_system");

  const userContent: ChatCompletionContentPart[] = [
    textPart(args.prompt),
    imagePart(args.imageUrl),
  ];

  const res = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  const text = res.choices[0]?.message?.content?.trim() || "Sem análise.";
  const usage: Usage = {
    input: res.usage?.prompt_tokens ?? 0,
    output: res.usage?.completion_tokens ?? 0,
  };

  return { text, model, prompt: args.prompt, usage };
}
