import { test, expect } from '@playwright/test'

test.describe('Marketplace feed', () => {
  test('marketplace feed loads with heading', async ({ page }) => {
    await page.goto('/listings')
    await expect(page.getByRole('heading', { name: /available items/i })).toBeVisible()
  })

  test('search input is visible on the listings page', async ({ page }) => {
    await page.goto('/listings')
    await expect(page.getByPlaceholder(/search items/i)).toBeVisible()
  })

  test('post an item link is present', async ({ page }) => {
    await page.goto('/listings')
    // Scope to main content to avoid matching the nav header link as well
    await expect(page.getByRole('main').getByRole('link', { name: /post an item/i })).toBeVisible()
  })

  test('item cards link to detail pages', async ({ page }) => {
    await page.goto('/listings')
    // Use CSS :not() to exclude the /listings/new link at the selector level
    const itemLinks = page.locator('a[href^="/listings/"]:not([href="/listings/new"])')
    const count = await itemLinks.count()
    // Either no items (empty state) or all cards are links to /listings/<uuid>
    if (count > 0) {
      const firstHref = await itemLinks.first().getAttribute('href')
      expect(firstHref).toMatch(/^\/listings\/[a-zA-Z0-9-]+$/)
    }
  })
})
