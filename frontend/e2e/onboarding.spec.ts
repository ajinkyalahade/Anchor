import { expect, test } from '@playwright/test';

// Full-stack smoke: the onboarding journey creates a real account through the
// Vite proxy → backend → Postgres, so a green run proves every layer is wired
// together (the gap that let SEC-1/SEC-2 through per the audit).

test('login page renders (frontend is served)', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});

test('onboarding creates an account end-to-end', async ({ page }) => {
  await page.goto('/onboarding');

  // Welcome → tags
  await page.getByRole('button', { name: /^Start/ }).click();

  // Pick a challenge, advance
  await page.getByRole('button', { name: "Can't start things" }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // Pick a crash window, advance
  await page.getByText('Morning', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // Skip account creation → posts /onboarding (register-anonymous path)
  await page.getByRole('button', { name: /Skip for now/i }).click();

  // A user id is only persisted after the backend round-trip succeeds — this
  // is the assertion that the whole stack (proxy + API + DB) worked.
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('anchor_user_id')), {
      timeout: 15_000,
    })
    .not.toBeNull();

  // And the flow has advanced past the email step into the tour.
  await expect(
    page.getByRole('button', { name: /Show me how to navigate/i }),
  ).toBeVisible();
});
