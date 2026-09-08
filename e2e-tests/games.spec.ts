import { test, expect, type Response } from '@playwright/test';

test.describe('Game Listing and Navigation', () => {
  test('should display games with titles on index page', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
    });

    await test.step('Verify games grid is visible', async () => {
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Verify game cards are displayed', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first()).toBeVisible();
      expect(await gameCards.count()).toBeGreaterThan(0);
    });

    await test.step('Verify game cards have titles with content', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first().getByTestId('game-title')).toBeVisible();
      await expect(gameCards.first().getByTestId('game-title')).not.toBeEmpty();
    });
  });

  test('should filter by multiple categories using OR semantics', async ({ page }) => {
    await page.goto('/');
    const visibleCards = page.locator('[data-testid="game-card"]:visible');
    const totalGames = await page.getByTestId('game-card').count();

    await test.step('Select two categories', async () => {
      await page.getByRole('checkbox', { name: 'Strategy' }).check();
      await expect(visibleCards).toHaveCount(4);

      await page.getByRole('checkbox', { name: 'Puzzle' }).check();
      await expect(visibleCards).toHaveCount(8);
    });

    await test.step('Verify every result belongs to either selected category', async () => {
      const categoryNames = await visibleCards.getByTestId('game-category').allTextContents();
      expect(new Set(categoryNames)).toEqual(new Set(['Strategy', 'Puzzle']));
      await expect(page.getByTestId('filter-results-count'))
        .toHaveText(`Showing 8 of ${totalGames} games`);
    });
  });

  test('should filter by publisher', async ({ page }) => {
    await page.goto('/');
    const visibleCards = page.locator('[data-testid="game-card"]:visible');

    await page.getByLabel('Publisher').selectOption({ label: 'CodeForge Studios' });

    await expect(visibleCards.first()).toBeVisible();
    const publisherNames = await visibleCards.getByTestId('game-publisher').allTextContents();
    expect(new Set(publisherNames)).toEqual(new Set(['CodeForge Studios']));
  });

  test('should combine category and publisher filters', async ({ page }) => {
    await page.goto('/');
    const visibleCards = page.locator('[data-testid="game-card"]:visible');

    await test.step('Select a category and publisher', async () => {
      await page.getByRole('checkbox', { name: 'Strategy' }).check();
      await page.getByLabel('Publisher').selectOption({ label: 'GitHub Games' });
    });

    await test.step('Verify only the combined match remains', async () => {
      await expect(visibleCards).toHaveCount(1);
      await expect(visibleCards.getByTestId('game-category')).toHaveText('Strategy');
      await expect(visibleCards.getByTestId('game-publisher')).toHaveText('GitHub Games');
    });
  });

  test('should store filters in the URL and restore them after reload', async ({ page }) => {
    await page.goto('/');
    const strategyFilter = page.getByRole('checkbox', { name: 'Strategy' });
    const publisherFilter = page.getByLabel('Publisher');
    const strategyId = await strategyFilter.getAttribute('value');

    await test.step('Select filters and verify URL parameters', async () => {
      await strategyFilter.check();
      await publisherFilter.selectOption({ label: 'GitHub Games' });

      await expect.poll(() => new URL(page.url()).searchParams.getAll('category'))
        .toEqual([strategyId]);
      await expect.poll(() => new URL(page.url()).searchParams.has('publisher'))
        .toBe(true);
    });

    await test.step('Reload and verify controls and results are restored', async () => {
      await page.reload();

      await expect(strategyFilter).toBeChecked();
      await expect(publisherFilter).toHaveValue(/.+/);
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(1);
    });
  });

  test('should clear all selected filters', async ({ page }) => {
    await page.goto('/');
    const allCards = page.getByTestId('game-card');
    const totalGames = await allCards.count();

    await page.getByRole('checkbox', { name: 'Strategy' }).check();
    await page.getByLabel('Publisher').selectOption({ label: 'GitHub Games' });
    await page.getByRole('button', { name: 'Clear filters' }).click();

    await expect(page.getByRole('checkbox', { name: 'Strategy' })).not.toBeChecked();
    await expect(page.getByLabel('Publisher')).toHaveValue('');
    await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(totalGames);
    await expect(page).toHaveURL('/');
  });

  test('should support filtering with the keyboard', async ({ page }) => {
    await page.goto('/');
    const strategyFilter = page.getByRole('checkbox', { name: 'Strategy' });

    await strategyFilter.focus();
    await expect(strategyFilter).toBeFocused();
    await page.keyboard.press('Space');

    await expect(strategyFilter).toBeChecked();
    await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(4);
  });

  test('should navigate to correct game details page when clicking on a game', async ({ page }) => {
    let gameId: string | null;
    let gameTitle: string | null;

    await test.step('Navigate to homepage and wait for games to load', async () => {
      await page.goto('/');
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Get first game information and click it', async () => {
      const firstGameCard = page.getByTestId('game-card').first();
      gameId = await firstGameCard.getAttribute('data-game-id');
      gameTitle = await firstGameCard.getAttribute('data-game-title');
      await firstGameCard.click();
    });

    await test.step('Verify navigation to game details page', async () => {
      await expect(page).toHaveURL(`/game/${gameId}`);
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title matches clicked game', async () => {
      if (gameTitle) {
        await expect(page.getByTestId('game-details-title')).toHaveText(gameTitle);
      }
    });
  });

  test('should display game details with all required information', async ({ page }) => {
    await test.step('Navigate to specific game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title is displayed', async () => {
      const gameTitle = page.getByTestId('game-details-title');
      await expect(gameTitle).toBeVisible();
      await expect(gameTitle).not.toBeEmpty();
    });

    await test.step('Verify game description is displayed', async () => {
      const gameDescription = page.getByTestId('game-details-description');
      await expect(gameDescription).toBeVisible();
      await expect(gameDescription).not.toBeEmpty();
    });

    await test.step('Verify publisher or category information is present', async () => {
      const publisherExists = await page.getByTestId('game-details-publisher').isVisible();
      const categoryExists = await page.getByTestId('game-details-category').isVisible();
      expect(publisherExists || categoryExists).toBeTruthy();

      if (publisherExists) {
        await expect(page.getByTestId('game-details-publisher')).not.toBeEmpty();
      }

      if (categoryExists) {
        await expect(page.getByTestId('game-details-category')).not.toBeEmpty();
      }
    });
  });

  test('should display a button to back the game', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify back game button is visible and enabled', async () => {
      const backButton = page.getByTestId('back-game-button');
      await expect(backButton).toBeVisible();
      await expect(backButton).toContainText('Support This Game');
      await expect(backButton).toBeEnabled();
    });
  });

  test('should be able to navigate back to home from game details', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Click back to all games link', async () => {
      const backLink = page.getByRole('link', { name: /back to all games/i });
      await expect(backLink).toBeVisible();
      await backLink.click();
    });

    await test.step('Verify navigation back to homepage', async () => {
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });
  });

  test('should return a 404 page for a non-existent game', async ({ page }) => {
    let response: Response | null;

    await test.step('Navigate to non-existent game', async () => {
      response = await page.goto('/game/99999');
    });

    await test.step('Verify a branded 404 page is served', async () => {
      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle(/Page Not Found - Tailspin Toys/);
      await expect(page.getByTestId('not-found')).toBeVisible();
      await expect(page.getByTestId('not-found-heading')).not.toBeEmpty();
      await expect(page.getByTestId('not-found-home-link')).toBeVisible();
    });
  });
});
