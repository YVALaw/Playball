# Playball tutorial update — September 9, 2026

## What changed

- Rewrote the guided tour and all existing first-visit cards in plain language.
- Each lesson now separates the explanation from a clear “What to do” instruction.
- Added contextual help for the Program overview, budget, staff, facilities, network, and transfer portal.
- Added Screen help to reopen a lesson, including when automatic tutorials are turned off. Multi-page cards now have Back and Close controls.
- The tour shows step progress, offers Skip step for main lessons, and keeps Read again and End tour available beside the highlight.
- Kept the dark backdrop and red glow; changed the rapid, large pulse to a slower glow around a stable outline.
- Increased lesson text size and button targets, allowed tall cards to scroll, and added dialog and spotlight keyboard navigation. Reduced-motion settings retain a static outline.
- The hiring lesson allows comparison across the candidate carousel instead of forcing the first candidate. It only treats the market as unaffordable when every candidate is out of budget.
- Explained that tour purchases and lineup exercises change the actual career, and made those exercises skippable.
- Fixed progression after an unavailable/skipped hire and after a resumed or recorded game has passed the first-inning teaching moments.
- Corrected draft funding, recruiting timing, and postseason explanations. Numeric tournament help uses existing engine constants.

## Scope

This is the full source project, not a patch-only archive or an APK. Source, assets, and existing project files are included. Dependencies and generated build output are excluded.

No simulation engine, tournament format, save schema, economy balance, or testing shortcut was changed. SIM THE SEASON and the Pascagoula Tech test setup retain their original behavior.

## Validation

- 47 tests passed across guide.test.ts, overhaul.test.ts, and economy.test.ts.
- Six new regression cases cover late game resumes, already-recorded games, pending games, skipped hires, and individual lesson skipping.
- Full TypeScript/build verification is blocked in this environment by unavailable @radix-ui/react-icons and @capacitor/core packages. The same missing-package diagnostics were present before these changes; this is an environment limitation, not a demonstrated project dependency defect.
- The preview browser refused the local app with ERR_BLOCKED_BY_CLIENT. The revised UI has NOT been visually verified or tested on an Android device.

Before release, install the locked dependencies and run npm run check and npm run build. On a phone, check a fresh tour, an unaffordable hire, skipping purchases, resuming after the first inning, light/dark themes, large text, reduced motion, keyboard focus, and Screen help with automatic tutorials off.

## Changed files

- `src/ui/GuidedStretch.tsx`
- `src/ui/Tutorial.tsx`
- `src/ui/guide.ts`
- `src/ui/prototype-frame.css`
- `src/ui/screens/Portal.tsx`
- `src/ui/screens/Program.tsx`
- `src/ui/screens/Settings.tsx`
- `src/ui/tutorials.ts`
- `tests/guide.test.ts`
