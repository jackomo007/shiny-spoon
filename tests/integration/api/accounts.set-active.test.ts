import { beforeEach, describe, expect, it, vi } from "vitest"

const { getServerSessionMock, setActiveAccountIdMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  setActiveAccountIdMock: vi.fn(),
}))

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/account", () => ({
  setActiveAccountId: setActiveAccountIdMock,
}))

import { POST } from "@/app/api/accounts/set-active/route"

describe("POST /api/accounts/set-active", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    setActiveAccountIdMock.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await POST(
      new Request("http://localhost/api/accounts/set-active", {
        method: "POST",
        body: JSON.stringify({ accountId: "acc_1" }),
      }),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 400 for invalid payloads", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "7" } })

    const response = await POST(
      new Request("http://localhost/api/accounts/set-active", {
        method: "POST",
        body: JSON.stringify({ accountId: "" }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid payload" })
  })

  it("returns 404 when the account does not belong to the user", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "7" } })
    setActiveAccountIdMock.mockResolvedValue(false)

    const response = await POST(
      new Request("http://localhost/api/accounts/set-active", {
        method: "POST",
        body: JSON.stringify({ accountId: "acc_missing" }),
      }),
    )

    expect(setActiveAccountIdMock).toHaveBeenCalledWith(7, "acc_missing")
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "Not found" })
  })

  it("returns ok for valid account switches", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "7" } })
    setActiveAccountIdMock.mockResolvedValue(true)

    const response = await POST(
      new Request("http://localhost/api/accounts/set-active", {
        method: "POST",
        body: JSON.stringify({ accountId: "acc_1" }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})
