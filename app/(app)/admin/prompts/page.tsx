import "server-only";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AdminPromptsClient from "../prompts-client";

export default async function AdminPromptsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return null;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4">
        <Link
          href="/admin"
          className="text-sm text-gray-600 hover:underline"
        >
          ← Back to Admin
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">Prompts</h1>
      <p className="text-sm text-gray-600 mb-6">
        Edit the prompts used by the AI (Trade Analyzer, Chart Analyzer, Price Structure).
      </p>

      <AdminPromptsClient />
    </div>
  );
}
