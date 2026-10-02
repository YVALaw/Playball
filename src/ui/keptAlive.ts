// keptAlive.ts
// The screens App keeps mounted behind the one on show, and where each was
// left. Pure, so the rules are tested in node.
//
// One instance per visit (S6, 2026-09-30): a screen the trail holds twice
// (Colleges on Desert, then Colleges on Mountain) is two instances, and a
// back move gets its own one back, filters, tabs and height as it was left.

/** How many screens stay alive: the one on show and three behind it. */
export const KEEP_ALIVE = 4;

/** One kept screen: its route, the mount it belongs to, and its visit's id. */
export interface AliveEntry<R> { r: R; gen: number; id: string }

/** The screens kept alive, most recent last (the one on show). */
export interface Alive<R> { list: Array<AliveEntry<R>>; last: string | null; gen: number }

/** A screen on one visit: the visit alone is not enough, a game or a direct write can change the screen without a fresh visit. */
export function visitKey(visit: number, route: string): string {
  return `${visit}:${route}`;
}

/**
 * The screens to keep mounted, with the one on show moved to the end.
 *
 * Only a BACK navigation gets the kept screen back — the very instance that
 * visit left, its state and scroll intact. Going somewhere forward opens it
 * fresh: a screen told where to look (the lineup opened on a hurt man,
 * 2026-09-24) must not come back as it was left on another visit. Earlier
 * visits to the same screen stay alive beside it. `restoring` is the store's
 * word that this visit is one a back move returned to. Idempotent, so a
 * second render in the same state changes nothing.
 */
export function keptAlive<R>(
  ref: { current: Alive<R> }, current: R, key: (r: R) => string, visit: number, restoring: boolean,
): Array<AliveEntry<R>> {
  const state = ref.current;
  const id = visitKey(visit, key(current));
  if (state.last !== id) {
    const kept = restoring ? state.list.find((e) => e.id === id) : undefined;
    const entry = kept ?? { r: current, gen: ++state.gen, id };
    state.list = [...state.list.filter((e) => e.id !== id), entry];
    while (state.list.length > KEEP_ALIVE) state.list.shift();
    state.last = id;
  }
  return state.list;
}

/** How many heights scroll memory holds; the oldest visit goes first. */
export const SCROLL_MEMORY = 64;

/** Remember where a visit's screen was left, newest last, capped. */
export function rememberScroll(memory: Map<string, number>, id: string, y: number): void {
  memory.delete(id);
  memory.set(id, y);
  while (memory.size > SCROLL_MEMORY) memory.delete(memory.keys().next().value as string);
}

/** A screen on a visit, as the store holds it. */
export interface Spot<T extends string = string> { tab: T; screen: string; routeVisit: number }

/** Where a spot's height lives in scroll memory: App writes and reads with this one key. */
export function scrollId<T extends string>(at: Spot<T>, key: (r: { tab: T; screen: string }) => string): string {
  return visitKey(at.routeVisit, key({ tab: at.tab, screen: at.screen }));
}

/** The id to file the height under when the store moves from `prev` to `s`: the visit being left, or null when nothing moved. */
export function leftScroll<T extends string>(s: Spot<T>, prev: Spot<T>, key: (r: { tab: T; screen: string }) => string): string | null {
  if (s.tab === prev.tab && s.screen === prev.screen && s.routeVisit === prev.routeVisit) return null;
  return scrollId(prev, key);
}
