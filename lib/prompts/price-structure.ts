import "server-only";
import { getPrompt } from "@/lib/app-prompts";

export async function buildPriceStructurePrompt(params: {
  asset: string;
  timeframe: string;
  lastPrice: number;
}): Promise<string> {
  const tpl = await getPrompt("price_structure_template");

  const base = tpl
    .replace("{{asset}}", params.asset)
    .replace("{{timeframe}}", params.timeframe);

  const withContext = `${base}

Current price (for context): ${params.lastPrice}.`;

  return withContext;
}
