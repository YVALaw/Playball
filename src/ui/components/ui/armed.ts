// armed.ts
// The one armed control in the app.
//
// A two-press control (ConfirmButton, and the legacy Confirmable it replaces)
// arms on the first press and acts on the second. Only one may be armed at a
// time: arming a second disarms the first, because two live triggers on one
// screen is how a thumb spends money on the wrong thing. Both controls share
// this holder so the rule holds across old and new screens alike.

export const armedLock: { current: { id: symbol; disarm: () => void } | null } = { current: null };
