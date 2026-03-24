import { beforeEach, describe, expect, it, vi } from "vitest"

const { cookiesMock, getServerSessionMock, findFirstMock, setCookieMock } =
  vi.hoisted(() => ({
    cookiesMock: vi.fn(),
    getServerSessionMock: vi.fn(),
    findFirstMock: vi.fn(),
    setCookieMock: vi.fn(),
  }))

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    account: {
      findFirst: findFirstMock,
    },
  },
}))

import { POST } from "@/app/api/accounts/switch/route"

describe("POST /api/accounts/switch", () => {
  beforeEach(() => {
    cookiesMock.mockReset()
    getServerSessionMock.mockReset()
    findFirstMock.mockReset()
    setCookieMock.mockReset()
    cookiesMock.mockResolvedValue({ set: setCookieMock })
  })

  it("returns 401 when there is no authenticated user", async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await POST(
      new Request("http://localhost/api/accounts/switch", {
        method: "POST",
        body: JSON.stringify({ accountId: "acc_1" }),
      }),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 400 for invalid payloads", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "9" } })

    const response = await POST(
      new Request("http://localhost/api/accounts/switch", {
        method: "POST",
        body: JSON.stringify({ accountId: "" }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid payload" })
  })

  it("returns 404 when the user does not own the account", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "9" } })
    findFirstMock.mockResolvedValue(null)

    const response = await POST(
      new Request("http://localhost/api/accounts/switch", {
        method: "POST",
        body: JSON.stringify({ accountId: "acc_missing" }),
      }),
    )

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: "acc_missing", user_id: 9 },
      select: { id: true },
    })
    expect(response.status).toBe(404)
  })

  it("sets the active account cookie on success", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "9" } })
    findFirstMock.mockResolvedValue({ id: "acc_1" })

    const response = await POST(
      new Request("http://localhost/api/accounts/switch", {
        method: "POST",
        body: JSON.stringify({ accountId: "acc_1" }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(setCookieMock).toHaveBeenCalledWith(
      "active_account_id",
      "acc_1",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
      }),
    )
  })
})
