import { expect, test } from "@playwright/test"

test("login and register pages load through the real app", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible()

  await page.getByRole("link", { name: /Create one/i }).click()

  await expect(page).toHaveURL(/\/register$/)
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible()
})

test("register page enforces client-side validation", async ({ page }) => {
  await page.goto("/register")

  const submit = page.getByRole("button", { name: "Create account" })

  await expect(submit).toBeDisabled()
  await page.getByPlaceholder("Email").fill("invalid")
  await page.getByPlaceholder("Username").fill("ab")
  await page.getByPlaceholder("Password").fill("123")

  await expect(page.getByText("Please enter a valid email.")).toBeVisible()
  await expect(
    page.getByText("Username must be at least 3 characters."),
  ).toBeVisible()
  await expect(
    page.getByText("Password must be at least 6 characters."),
  ).toBeVisible()
  await expect(submit).toBeDisabled()
})
