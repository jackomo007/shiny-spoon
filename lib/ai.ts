import OpenAI from "openai"
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function analyzeChartImage(imageUrl: string) {
  const prompt = "Analyze this chart and tell me what's happening."
  const model = "gpt-4o-mini"

  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "You are a professional crypto market analyst. Focus only on the chart image." },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    temperature: 0.2,
  })

  return {
    text: res.choices[0]?.message?.content?.trim() || "No analysis.",
    model,
    prompt,
  }
}
