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
    await expect(page.getByRole('link', { name: /post an item/i })).toBeVisible()
  })

  test('item cards link to detail pages', async ({ page }) => {
    await page.goto('/listings')
    // If there are items, each card should link to /listings/<id>
    const itemLinks = page.locator('a[href^="/listings/"]').filter({ hasNot: page.locator('[href="/listings/new"]') })
    const count = await itemLinks.count()
    // Either no items (empty state) or all cards are links
    if (count > 0) {
      const firstHref = await itemLinks.first().getAttribute('href')
      expect(firstHref).toMatch(/^\/listings\/[a-zA-Z0-9-]+$/)
    }
  })
})
