import RegisterPage from "@/app/(auth)/register/page"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { routerMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}))

describe("RegisterPage", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    routerMock.push.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  it("keeps submit disabled until the form is valid", async () => {
    const user = userEvent.setup()

    render(<RegisterPage />)

    const submit = screen.getByRole("button", { name: /Create account/i })

    expect(submit).toBeDisabled()

    await user.type(screen.getByPlaceholderText("Email"), "invalid-email")
    await user.type(screen.getByPlaceholderText("Username"), "ab")
    await user.type(screen.getByPlaceholderText("Password"), "123")

    expect(screen.getByText("Please enter a valid email.")).toBeInTheDocument()
    expect(
      screen.getByText("Username must be at least 3 characters."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Password must be at least 6 characters."),
    ).toBeInTheDocument()
    expect(submit).toBeDisabled()
  })

  it("submits a valid form and redirects to login", async () => {
    const user = userEvent.setup()

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))

    render(<RegisterPage />)

    await user.type(screen.getByPlaceholderText("Email"), "greto@example.com")
    await user.type(screen.getByPlaceholderText("Username"), "greto")
    await user.type(screen.getByPlaceholderText("Password"), "supersecret")
    await user.click(screen.getByRole("button", { name: /Create account/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      )
    })
    expect(routerMock.push).toHaveBeenCalledWith("/login")
  })
})
