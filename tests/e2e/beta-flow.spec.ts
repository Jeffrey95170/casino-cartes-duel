import { expect, test, type Page } from "@playwright/test";

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    Math.random = () => 0.42;
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
      nativeSetTimeout(handler, Math.min(timeout ?? 0, 25), ...args)) as typeof window.setTimeout;
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        (window as typeof window & { __shared?: boolean }).__shared = true;
      },
    });
  });
}

async function startAndSkipTutorial(page: Page) {
  await page.getByRole("button", { name: "Jouer maintenant" }).click();
  await expect(page.getByRole("dialog", { name: /Choisissez votre carte/ })).toBeVisible();
  await page.getByRole("button", { name: "Passer" }).click();
  await expect(page.locator(".felt-table")).toBeVisible();
}

async function waitForPlayerTurn(page: Page) {
  await expect.poll(
    async () => page.locator(".hand-card-button:not(:disabled)").count(),
    { timeout: 3_000 },
  ).toBeGreaterThan(0);
}

test.beforeEach(async ({ page }) => {
  await preparePage(page);
});

test("premier lancement : CTA visible, tutoriel complet et jeu sans débordement mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto("/");

  const cta = page.getByRole("button", { name: "Jouer maintenant" });
  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await cta.click();

  await expect(page.getByText("Étape 1 sur 4")).toBeVisible();
  for (let step = 2; step <= 4; step += 1) {
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect(page.getByText(`Étape ${step} sur 4`)).toBeVisible();
  }
  await page.getByRole("button", { name: "Jouer" }).click();
  await expect(page.locator(".felt-table")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});

test("le tutoriel peut être passé et relancé depuis le guide", async ({ page }) => {
  await page.goto("/");
  await startAndSkipTutorial(page);
  await page.getByRole("button", { name: "Guide" }).click();
  await expect(page.getByText("Étape 1 sur 4")).toBeVisible();
  await page.getByRole("button", { name: "Passer" }).click();
  await expect(page.locator(".felt-table")).toBeVisible();
});

test("une somme incorrecte donne une explication précise", async ({ page }) => {
  await page.goto("/");
  await startAndSkipTutorial(page);
  await waitForPlayerTurn(page);

  let foundInvalidSelection = false;
  const hand = page.locator(".hand-card-button:not(:disabled)");
  const tableGroups = page.locator(".table-group:not(:disabled)");
  for (let handIndex = 0; handIndex < await hand.count() && !foundInvalidSelection; handIndex += 1) {
    await hand.nth(handIndex).click();
    for (let groupIndex = 0; groupIndex < await tableGroups.count(); groupIndex += 1) {
      await tableGroups.nth(groupIndex).click();
      foundInvalidSelection = (await page.locator(".selection-summary.error").count()) > 0;
      if (foundInvalidSelection) break;
      await tableGroups.nth(groupIndex).click();
    }
  }

  expect(foundInvalidSelection).toBe(true);
  await expect(page.locator(".selection-summary.error")).toContainText(
    /Ces cartes totalisent \d+(?: ou \d+)? alors que votre carte vaut \d+(?: ou \d+)?\./,
  );
});

test("une partie complète enregistre le résultat, partage et rejoue", async ({ page }) => {
  await page.goto("/");
  await startAndSkipTutorial(page);

  for (let turn = 0; turn < 70; turn += 1) {
    if (await page.locator(".final-card").isVisible()) break;
    const continueButton = page.getByRole("button", { name: /Continuer/ });
    if (await continueButton.isVisible()) {
      await continueButton.click();
      continue;
    }
    await waitForPlayerTurn(page);
    await page.locator(".hand-card-button:not(:disabled)").first().click();
    await page.getByRole("button", { name: "Poser seule" }).click();
  }

  await expect(page.locator(".final-card")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Victoire|Défaite|Égalité/ })).toBeVisible();
  const stats = await page.evaluate(() => JSON.parse(window.localStorage.getItem("casino-duel:stats:v1") ?? "{}"));
  expect(stats.gamesStarted).toBe(1);
  expect(stats.gamesCompleted).toBe(1);

  await page.getByRole("button", { name: "Partager mon résultat" }).click();
  await expect(page.getByText("Résultat partagé !")).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { __shared?: boolean }).__shared)).toBe(true);

  await page.getByRole("button", { name: /Rejouer/ }).click();
  await expect(page.locator(".final-card")).toBeHidden();
  await expect(page.locator(".scoreboard")).toBeVisible();
});

test("les largeurs smartphone restent sans défilement horizontal", async ({ page }) => {
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
});
