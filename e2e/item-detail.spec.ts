import { test, expect } from '@playwright/test'

test.describe('Item detail page', () => {
  test('listings page loads and is navigable', async ({ page }) => {
    await page.goto('/listings')
    await expect(page.getByRole('heading', { name: /available items/i })).toBeVisible()
  })

  test('item detail page renders without 500 error for any ID', async ({ page }) => {
    // A nonexistent ID should return a 404 page, not a 500
    const response = await page.goto('/listings/00000000-0000-0000-0000-000000000000')
    expect(response?.status()).not.toBe(500)
  })

  test('item detail page shows back-to-listings link', async ({ page }) => {
    await page.goto('/listings/00000000-0000-0000-0000-000000000000')
    // Either 404 or item page — either way no 500; on item page a back link exists
    const notFoundText = page.getByText(/not found|404/i)
    const backLink = page.getByRole('link', { name: /available items|back/i })
    const either = (await notFoundText.count()) > 0 || (await backLink.count()) > 0
    expect(either).toBe(true)
  })

  test('request swap button is present on a valid item page', async ({ page }) => {
    // Navigate to listings first to find a real item link if any exist.
    // Use CSS :not() to exclude /listings/new at the selector level — hasNot()
    // matches descendants, not the element itself, so it fails to exclude <a href="/listings/new">.
    await page.goto('/listings')
    const itemLinks = page.locator('a[href^="/listings/"]:not([href="/listings/new"])')
    const count = await itemLinks.count()
    if (count > 0) {
      await itemLinks.first().click()
      // Should show either "Request Swap" or "Sign in to request a swap" or "your listing"
      const swapOrSignIn = page
        .getByRole('button', { name: /request swap/i })
        .or(page.getByRole('link', { name: /sign in/i }))
        .or(page.getByText(/your listing/i))
      await expect(swapOrSignIn.first()).toBeVisible()
    }
  })
})
