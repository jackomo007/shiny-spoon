import OpenAI from "openai"
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function analyzeTradeWithChart(args: {
  imageUrl: string
  prompt: string
  model?: string
}) {
  const model = args.model ?? "gpt-4o-mini"
  const res = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: "Você é um analista de mercados sênior. Seja objetivo, evite jargões sem explicação e sempre detalhe riscos." },
      {
        role: "user",
        content: [
          { type: "text", text: args.prompt },
          { type: "image_url", image_url: { url: args.imageUrl } },
        ],
      },
    ],
  })
  const text = res.choices[0]?.message?.content?.trim() || "Sem análise."
  return { text, model, prompt: args.prompt }
}
