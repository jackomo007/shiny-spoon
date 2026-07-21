import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getServerSessionMock,
  getActiveAccountIdMock,
  journalEntryFindFirstMock,
  journalEntryDeleteMock,
  journalEntryTagDeleteManyMock,
  futuresTradeDeleteManyMock,
  spotTradeDeleteManyMock,
  transactionMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  getActiveAccountIdMock: vi.fn(),
  journalEntryFindFirstMock: vi.fn(),
  journalEntryDeleteMock: vi.fn(),
  journalEntryTagDeleteManyMock: vi.fn(),
  futuresTradeDeleteManyMock: vi.fn(),
  spotTradeDeleteManyMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/account", () => ({
  getActiveAccountId: getActiveAccountIdMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    journal_entry: {
      findFirst: journalEntryFindFirstMock,
    },
  },
}));

import { DELETE } from "@/app/api/journal/[id]/route";

describe("DELETE /api/journal/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue({ user: { id: "7" } });
    getActiveAccountIdMock.mockResolvedValue("acc_1");
    journalEntryFindFirstMock.mockResolvedValue({ id: "entry_1" });
    journalEntryTagDeleteManyMock.mockResolvedValue({ count: 1 });
    futuresTradeDeleteManyMock.mockResolvedValue({ count: 1 });
    spotTradeDeleteManyMock.mockResolvedValue({ count: 1 });
    journalEntryDeleteMock.mockResolvedValue({ id: "entry_1" });
    transactionMock.mockImplementation(async (callback) =>
      callback({
        journal_entry_tag: { deleteMany: journalEntryTagDeleteManyMock },
        futures_trade: { deleteMany: futuresTradeDeleteManyMock },
        spot_trade: { deleteMany: spotTradeDeleteManyMock },
        journal_entry: { delete: journalEntryDeleteMock },
      }),
    );
  });

  it("deletes dependent rows before deleting the journal entry", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/journal/entry_1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "entry_1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(journalEntryFindFirstMock).toHaveBeenCalledWith({
      where: { id: "entry_1", account_id: "acc_1" },
      select: { id: true },
    });
    expect(journalEntryTagDeleteManyMock).toHaveBeenCalledWith({
      where: { journal_entry_id: "entry_1" },
    });
    expect(futuresTradeDeleteManyMock).toHaveBeenCalledWith({
      where: { journal_entry_id: "entry_1" },
    });
    expect(spotTradeDeleteManyMock).toHaveBeenCalledWith({
      where: { journal_entry_id: "entry_1" },
    });
    expect(journalEntryDeleteMock).toHaveBeenCalledWith({
      where: { id: "entry_1" },
    });
    expect(journalEntryDeleteMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      spotTradeDeleteManyMock.mock.invocationCallOrder[0],
    );
  });

  it("returns 404 when the entry does not belong to the active account", async () => {
    journalEntryFindFirstMock.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest("http://localhost/api/journal/missing", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
