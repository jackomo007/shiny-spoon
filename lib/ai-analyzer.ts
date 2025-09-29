import OpenAI from "openai"
import { getPrompt } from "@/lib/app-prompts"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

type TextPart = { type: "text"; text: string }
type ImagePart = { type: "image_url"; image_url: { url: string } }
type UserContent = Array<TextPart | ImagePart>

export async function analyzeChartImage(imageUrl: string) {
  const systemPrompt = await getPrompt("chart_analysis_system")
  const userText = "Analyze this chart and tell me what's happening."
  const model = "gpt-4o-mini"

  const userContent: UserContent = [
    { type: "text", text: userText },
    { type: "image_url", image_url: { url: imageUrl } },
  ]

  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
  })

  return {
    text: res.choices[0]?.message?.content?.trim() || "No analysis.",
    model,
    prompt: userText,
  }
}

export async function analyzeTradeWithChart(args: {
  imageUrl: string
  prompt: string
  model?: string
}) {
  const model = args.model ?? "gpt-4o-mini"
  const systemPrompt = await getPrompt("trade_analyzer_system")

  const userContent: UserContent = [
    { type: "text", text: args.prompt },
    { type: "image_url", image_url: { url: args.imageUrl } },
  ]

  const res = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  })

  const text = res.choices[0]?.message?.content?.trim() || "Sem análise."
  return { text, model, prompt: args.prompt }
}
