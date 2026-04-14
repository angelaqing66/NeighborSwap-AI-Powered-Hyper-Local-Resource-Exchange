import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/NeighborSwap/i)
  })

  test('login page is reachable', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })

  test('register page is reachable', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /sign up|create account/i })).toBeVisible()
  })
})
