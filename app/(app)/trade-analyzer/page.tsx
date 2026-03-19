export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function TradeAnalyzerPage() {
  redirect("/dashboard");
}
