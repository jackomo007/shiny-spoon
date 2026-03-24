import AccountSwitcher from "@/components/account/AccountSwitcher"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { routerMock } = vi.hoisted(() => ({
  routerMock: {
    refresh: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}))

describe("AccountSwitcher", () => {
  const fetchMock = vi.fn()
  const alertMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    alertMock.mockReset()
    routerMock.refresh.mockReset()
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("alert", alertMock)
  })

  it("loads accounts and highlights the active one", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            { id: "acc_1", name: "Crypto wallet", type: "crypto" },
            { id: "acc_2", name: "Forex desk", type: "forex" },
          ],
          activeId: "acc_1",
        }),
      ),
    )

    render(<AccountSwitcher open onClose={vi.fn()} />)

    expect(await screen.findByText("Crypto wallet")).toBeInTheDocument()
    expect(screen.getByText("FOREX")).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("switches account and refreshes the router", async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              { id: "acc_1", name: "Crypto wallet", type: "crypto" },
              { id: "acc_2", name: "Trading desk", type: "stock" },
            ],
            activeId: "acc_1",
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))

    render(<AccountSwitcher open onClose={onClose} />)

    await user.click(await screen.findByRole("button", { name: /Trading desk/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/accounts/switch",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ accountId: "acc_2" }),
        }),
      )
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(routerMock.refresh).toHaveBeenCalledTimes(1)
  })

  it("renders an error state when loading fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }))

    render(<AccountSwitcher open onClose={vi.fn()} />)

    expect(await screen.findByText("boom")).toBeInTheDocument()
  })
})
