// world.ts
// The seed the world is built from.
//
// One constant in its own file because of what importing it used to cost. It
// lived in the store, so a test that wanted the number pulled in the store, and
// with it Zustand, IndexedDB, the sim worker client and the whole engine — thirty
// seconds of transform for one integer, and a five second test timing out on a
// value that never changes.
//
// The same seed every time is the point: every player gets the same sixty four
// programs, so "I took the Pascagoula job" means the same thing to everybody.

export const WORLD_SEED = 2027;

/**
 * The year a dynasty starts.
 *
 * It used to be the seed, because the seed happened to be 2027 and nobody
 * noticed the two were doing different jobs. They are not the same thing: one
 * is a calendar and the other decides what every player in the world is like.
 * Handing a career a random seed with them still joined would have opened the
 * game in the year 1,483,920,174.
 */
export const START_YEAR = 2027;

/**
 * A seed for one career.
 *
 * The schools are static data — names, colours, regions, quality all live in
 * `schools.ts` and do not come from here — so a fresh seed changes the players
 * and the games, not the world. Pascagoula Tech is still Pascagoula Tech, still
 * a Gulf program of the same standing; it is the twenty three men on its roster
 * and the season they play that differ.
 *
 * Reported from testing: "in every new career the same teams have the same
 * players and end in the same positions, I always finish with 11 or 7 losses".
 * That was exactly right, and it was not the simulation running out of variety —
 * every career was generated from the same constant, and the engine is
 * deterministic on purpose.
 */
export const careerSeed = (): number => (Math.random() * 2 ** 31) >>> 0;
