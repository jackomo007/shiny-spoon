import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CostsClient from "./costs-client";

export default async function CostsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return null;
  return <CostsClient />;
}
