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
