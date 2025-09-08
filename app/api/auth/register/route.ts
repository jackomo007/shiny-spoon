import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

import {
  account_type as AccountTypeEnum,
  type account_type as AccountType,
} from "@prisma/client";

const AccountTypeZ = z.nativeEnum(AccountTypeEnum);

const Schema = z.object({
  email: z.string().trim().email({ message: "Invalid email" }),
  username: z.string().trim().min(3, { message: "Username must be ≥ 3 chars" }),
  password: z.string().trim().min(6, { message: "Password must be ≥ 6 chars" }),
  types: z.array(AccountTypeZ).optional(),
});

const cookieOpts = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        errors: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const { email, username, password, types } = parsed.data;

  const incoming: AccountType[] = types ?? [];
  const chosen: AccountType[] = Array.from(
    new Set<AccountType>([...incoming, AccountTypeEnum.crypto])
  );

  const hash = await bcrypt.hash(password, 10);

  const { userId, cryptoId } = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email, username, password_hash: hash },
      select: { id: true },
    });

    let cryptoId: string | null = null;
    for (const t of chosen) {
      const display = t[0].toUpperCase() + t.slice(1);
      const a = await tx.account.create({
        data: {
          user_id: u.id,
          type: t,
          name: `My ${display} Account`,
        },
        select: { id: true, type: true },
      });
      if (a.type === AccountTypeEnum.crypto) cryptoId = a.id;
    }

    return { userId: u.id, cryptoId: cryptoId! };
  });

  const jar = await cookies();
  jar.set("active_account_id", cryptoId, cookieOpts);

  return NextResponse.json({ ok: true, userId });
}
