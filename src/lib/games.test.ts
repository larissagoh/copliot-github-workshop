import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getFilteredGames,
    getGameById,
} from './games';

interface FilterFixtureIds {
    strategyId: number;
    puzzleId: number;
    firstPublisherId: number;
    secondPublisherId: number;
}

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterGames(db: Database): Promise<FilterFixtureIds> {
    const [strategy, puzzle, simulation] = await db
        .insert(categories)
        .values([
            { name: 'Strategy', description: 'Strategy games' },
            { name: 'Puzzle', description: 'Puzzle games' },
            { name: 'Simulation', description: 'Simulation games' },
        ])
        .returning({ id: categories.id });
    const [firstPublisher, secondPublisher] = await db
        .insert(publishers)
        .values([
            { name: 'Zeta Games', description: 'First publisher' },
            { name: 'Alpha Studios', description: 'Second publisher' },
        ])
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Alpha Strategy',
            description: 'First strategy game',
            starRating: 4.1,
            categoryId: strategy.id,
            publisherId: firstPublisher.id,
        },
        {
            title: 'Beta Puzzle',
            description: 'Puzzle game',
            starRating: 4.2,
            categoryId: puzzle.id,
            publisherId: firstPublisher.id,
        },
        {
            title: 'Delta Strategy',
            description: 'Second strategy game',
            starRating: 4.3,
            categoryId: strategy.id,
            publisherId: secondPublisher.id,
        },
        {
            title: 'Gamma Simulation',
            description: 'Simulation game',
            starRating: 4.4,
            categoryId: simulation.id,
            publisherId: secondPublisher.id,
        },
    ]);

    return {
        strategyId: strategy.id,
        puzzleId: puzzle.id,
        firstPublisherId: firstPublisher.id,
        secondPublisherId: secondPublisher.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('returns an empty list when no games exist', async () => {
        expect(await getFilteredGames(db)).toEqual([]);
    });

    it('treats an empty category selection as unfiltered', async () => {
        await seedFilterGames(db);

        const filtered = await getFilteredGames(db, { categoryIds: [] });

        expect(filtered.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Beta Puzzle',
            'Delta Strategy',
            'Gamma Simulation',
        ]);
    });

    it('matches any selected category and preserves title ordering', async () => {
        const fixtureIds = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            categoryIds: [fixtureIds.strategyId, fixtureIds.puzzleId],
        });

        expect(filtered.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Beta Puzzle',
            'Delta Strategy',
        ]);
    });

    it('filters games by publisher', async () => {
        const fixtureIds = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            publisherId: fixtureIds.secondPublisherId,
        });

        expect(filtered.map((game) => game.title)).toEqual([
            'Delta Strategy',
            'Gamma Simulation',
        ]);
    });

    it('combines category and publisher filters', async () => {
        const fixtureIds = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            categoryIds: [fixtureIds.strategyId, fixtureIds.puzzleId],
            publisherId: fixtureIds.secondPublisherId,
        });

        expect(filtered.map((game) => game.title)).toEqual(['Delta Strategy']);
    });

    it('returns no games when filters do not match', async () => {
        await seedFilterGames(db);

        expect(await getFilteredGames(db, { categoryIds: [99999] })).toEqual([]);
        expect(await getFilteredGames(db, { publisherId: 99999 })).toEqual([]);
    });

    it('returns filter options ordered alphabetically', async () => {
        await seedFilterGames(db);

        const allCategories = await getAllCategories(db);
        const allPublishers = await getAllPublishers(db);

        expect(allCategories.map((category) => category.name)).toEqual([
            'Puzzle',
            'Simulation',
            'Strategy',
        ]);
        expect(allPublishers.map((publisher) => publisher.name)).toEqual([
            'Alpha Studios',
            'Zeta Games',
        ]);
    });
});
