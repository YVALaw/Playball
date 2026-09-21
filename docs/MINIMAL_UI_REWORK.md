# Minimal UI rework — 2026-09-18

This build implements the approved minimal Playball direction as a system-wide visual layer.

## Principles

- The four bottom-nav areas remain Home, Team, Season, and Program. Dashboard cards report state or expose contextual work; they are not a second copy of the main menu.
- Player portraits continue to use `src/ui/Avatar.tsx`, Playball's deterministic generated SVG avatars. No realistic/photo portraits were added.
- Android-first touch sizing: primary controls target 44–48 px minimum height and respect safe-area insets.
- The old dense square/tabletop look is replaced with quiet neutral backgrounds, soft cards, larger whitespace, modern segmented controls, rounded mobile surfaces, and lighter dividers.
- The implementation is intentionally state-safe: simulation, navigation routes, saves, recruiting logic, postseason logic, and player management behavior are unchanged.

## Main implementation

The redesign is centralized in `src/ui/minimal-ui.css`, imported last from `src/main.tsx`. This lets the new visual system cover all existing screens without forking working gameplay components or duplicating business logic.

Key screen families explicitly covered:

- Home / Today / Needs You / next-game actions
- Live game controls
- Roster and shared data tables
- Lineup, bench, rotation and bullpen
- Schedule and standings
- Program overview, staff/facilities, history and board surfaces
- Recruiting lists, filters and prospect workspaces
- Player profile and ratings/stats surfaces
- Menus, dialogs, sheets and overlays

The lineup's old vertical diamond position rail is also visually reflowed into a horizontal mobile chip rail so it reads as a modern control instead of a desktop/tool palette.
