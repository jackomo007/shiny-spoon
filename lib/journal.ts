import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getActiveAccountId } from "@/lib/account";
import { Prisma } from "@prisma/client";

const cookieOpts = { httpOnly: true as const, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function getActiveJournalId(userId: number): Promise<string> {
  const jar = await cookies();
  const fromCookie = jar.get("active_journal_id")?.value;
  if (fromCookie) return fromCookie;

  const accountId = await getActiveAccountId(userId);
  if (!accountId) throw new Error("Active account not found");

  const first = await prisma.journal.findFirst({
    where: { account_id: accountId },
    select: { id: true },
    orderBy: { created_at: "asc" },
  });
  if (first) {
    jar.set("active_journal_id", first.id, cookieOpts);
    return first.id;
  }

  try {
    const created = await prisma.journal.create({
      data: { account_id: accountId, name: "Main" },
      select: { id: true },
    });
    jar.set("active_journal_id", created.id, cookieOpts);
    return created.id;
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.journal.findFirst({
        where: { account_id: accountId, name: "Main" },
        select: { id: true },
      });
      if (existing) {
        jar.set("active_journal_id", existing.id, cookieOpts);
        return existing.id;
      }
    }
    throw err;
  }
}
