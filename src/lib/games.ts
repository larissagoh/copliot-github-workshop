import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

export interface GameFilters {
    /** Category identifiers to match using OR semantics. */
    categoryIds?: readonly number[];
    /** Publisher identifier that every returned game must match. */
    publisherId?: number;
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/**
 * Returns games that match the supplied category and publisher filters.
 *
 * Multiple category identifiers use OR semantics, while a publisher filter is
 * combined with the category selection using AND semantics.
 *
 * @param db - Database client supplied by the page or an in-memory test.
 * @param filters - Optional category and publisher identifiers to match.
 * @returns Matching games ordered alphabetically by title.
 */
export async function getFilteredGames(
    db: Database,
    filters: GameFilters = {},
): Promise<Game[]> {
    const categoryCondition = filters.categoryIds?.length
        ? inArray(games.categoryId, [...filters.categoryIds])
        : undefined;
    const publisherCondition = filters.publisherId === undefined
        ? undefined
        : eq(games.publisherId, filters.publisherId);
    const rows = await baseGamesQuery(db)
        .where(and(categoryCondition, publisherCondition))
        .orderBy(asc(games.title));

    return rows.map(mapGame);
}

/**
 * Returns every game in the catalog.
 *
 * @param db - Database client supplied by the page or an in-memory test.
 * @returns All games ordered alphabetically by title.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    return getFilteredGames(db);
}

/**
 * Returns every game identifier in deterministic title order.
 *
 * @param db - Database client supplied by the page or an in-memory test.
 * @returns Game identifiers ordered alphabetically by game title.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Returns one game by its database identifier.
 *
 * @param db - Database client supplied by the page or an in-memory test.
 * @param id - Identifier of the game to retrieve.
 * @returns The mapped game, or `null` when the identifier does not exist.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}

/**
 * Returns every category available for catalog filtering.
 *
 * @param db - Database client supplied by the page or an in-memory test.
 * @returns Categories ordered alphabetically by name.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    return db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.name));
}

/**
 * Returns every publisher available for catalog filtering.
 *
 * @param db - Database client supplied by the page or an in-memory test.
 * @returns Publishers ordered alphabetically by name.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
}
