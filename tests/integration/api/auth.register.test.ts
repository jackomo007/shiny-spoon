import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  cookiesMock,
  hashMock,
  setCookieMock,
  transactionMock,
  userCreateMock,
  accountCreateMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  hashMock: vi.fn(),
  setCookieMock: vi.fn(),
  transactionMock: vi.fn(),
  userCreateMock: vi.fn(),
  accountCreateMock: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}))

vi.mock("bcryptjs", () => ({
  default: { hash: hashMock },
  hash: hashMock,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}))

import { POST } from "@/app/api/auth/register/route"

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    cookiesMock.mockReset()
    hashMock.mockReset()
    setCookieMock.mockReset()
    transactionMock.mockReset()
    userCreateMock.mockReset()
    accountCreateMock.mockReset()

    cookiesMock.mockResolvedValue({ set: setCookieMock })
    hashMock.mockResolvedValue("hashed-password")
    transactionMock.mockImplementation(async (callback) =>
      callback({
        user: { create: userCreateMock },
        account: { create: accountCreateMock },
      }),
    )
  })

  it("returns validation errors for invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "invalid-email",
          username: "ab",
          password: "123",
        }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ path: "email" }),
        expect.objectContaining({ path: "username" }),
        expect.objectContaining({ path: "password" }),
      ]),
    })
  })

  it("creates the user, always includes a crypto account and sets the cookie", async () => {
    userCreateMock.mockResolvedValue({ id: 42 })
    accountCreateMock
      .mockResolvedValueOnce({ id: "acc_stock", type: "stock" })
      .mockResolvedValueOnce({ id: "acc_crypto", type: "crypto" })

    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "greto@example.com",
          username: "greto",
          password: "supersecret",
          types: ["stock"],
        }),
      }),
    )

    expect(hashMock).toHaveBeenCalledWith("supersecret", 10)
    expect(userCreateMock).toHaveBeenCalledWith({
      data: {
        email: "greto@example.com",
        username: "greto",
        password_hash: "hashed-password",
      },
      select: { id: true },
    })
    expect(accountCreateMock).toHaveBeenCalledTimes(2)
    expect(accountCreateMock.mock.calls.map(([arg]) => arg.data.type)).toEqual([
      "stock",
      "crypto",
    ])
    expect(setCookieMock).toHaveBeenCalledWith(
      "active_account_id",
      "acc_crypto",
      expect.objectContaining({ httpOnly: true }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, userId: 42 })
  })
})
