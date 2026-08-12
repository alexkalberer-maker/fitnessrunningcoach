# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**HYBRID** — a prototype training app that combines strength, running, cycling and swimming into one weekly plan. Vanilla JS, no framework, no build step, no backend. All data lives in `localStorage`.

UI strings, comments and commit messages are in German. Dates are formatted with the `de-CH` locale.

## Running & verifying

There is no package manager, build, lint or test setup — the repo is three static files.

```bash
# serve locally (file:// also works — no modules, no fetch)
python3 -m http.server 8000
```

Verification is manual in the browser. The fastest reset loop:

```js
localStorage.removeItem('hybrid-app-state')  // then reload → onboarding restarts
```

Because there are no tests, any change to `generatePlan()` should be sanity-checked by running the onboarding for several sport/goal combinations (especially: only `lauf`+`kraft` selected, and a triathlon race goal).

## Files

| File | Role |
|---|---|
| `index.html` | ~40 lines. Static shell only: header, empty `#content`, bottom nav. Everything else is rendered at runtime. |
| `app.js` | All logic (~2900 lines), organised into `// === SECTION ===` comment blocks. |
| `styles.css` | All styling. CSS custom properties in `:root`, dark theme, mobile-first (max 480px). |
| `PROJECT.md` | User-facing German description. **Partly outdated** — it still describes a single-file `hybrid-app-prototyp.html`; the code was since split into three files and gained the training-intelligence layer. |

## Architecture constraints that shape all code

**No modules, no bundler.** `app.js` runs as a classic script. Every function called from markup (`onclick="foo()"`) must be a top-level `function` declaration in `app.js`. Do not wrap code in IIFEs or add `type="module"` — it breaks every inline handler.

**Render = build an HTML string, assign `innerHTML`, done.** There is no virtual DOM and no reactivity. `renderHome()` / `renderStats()` / `renderProfile()` each rebuild their whole screen. After mutating `state`, call `saveState()` and then the relevant `render*()` — nothing updates on its own. Modals are built the same way through `showModal(html, title)`.

**`CONFIG` at the top of `app.js` is the tuning surface.** Durations, phase thresholds, pace offsets, default volumes, plan length. Convention (stated in the file): change values there, not inline in functions.

## Data model

```js
state = {
  user,               // onboardingData snapshot + name; null before onboarding
  currentPlan,        // [{ weekNumber, startDate: 'YYYY-MM-DD', days: {0..6} }, ...]
  workoutLogs,        // { 'YYYY-MM-DD': { workoutId: { sets, completed, ... } } }
  todayCheckin,
  viewingWeekIndex,   // which week the dashboard shows
  onboardingStep, onboardingData
}
```

Only those first four keys are persisted (`saveState()`); UI state is not.

**Day indices are Monday=0 … Sunday=6**, not JS `getDay()`. Use `getDayIndex(date)`.

**Plan and logs are deliberately decoupled.** The plan holds the *prescription*; `workoutLogs` holds what actually happened, keyed by date string. Two consequences worth knowing before touching workout tracking:

- `ensureSnapshot()` copies a workout's exercises into `log.exercisesSnapshot` the first time it's opened. All in-session edits (swap exercise, add set, delete) mutate the snapshot, never the plan — so regenerating the plan never rewrites history.
- Retro/custom workouts exist *only* in the log (`isCustom: true`, `customMeta`). `findWorkout()` therefore checks the log before searching the plan.

## The plan generator

`generatePlan(data)` is the core. It takes a user-data object plus `data._weekIndex` and returns a single week (`{0..6}`). It is called from two places: `generate4WeekPlan()` at onboarding, and `navigateWeek(+1)` which generates a new week just-in-time when the user scrolls past the end (capped at `CONFIG.MAX_PLAN_WEEKS`).

Pipeline inside one week:

1. `getTrainingPhase(data, weekIdx)` → `base | build | peak | taper | post_race`, derived from weeks-until-race against `CONFIG.PHASE_THRESHOLDS`. Falls back to `base`/`build` by goal when no race is set.
2. Volumes are read per sport, **gated by `hasSport()`** — a sport not chosen in onboarding must yield 0 units. (This guard exists because default volumes would otherwise silently plan a cycling session.)
3. Taper scales volumes down (0.7 / 0.5) and caps strength sessions; peak caps them at 2.
4. Placement order is fixed and each stage narrows the days left for the next: **Kraft → Lauf → Brick → Rad → Schwimm**.
5. `selectLaufTypes(phase, ...)` / `selectRadTypes(phase, ...)` decide *which* workout types the week gets; `createLaufWorkout` / `createRadWorkout` / `createBrickWorkout` turn a type into a workout object.

Placement rules encoded in the day-picking helpers (`pickSpread`, `isAfterHard`, `nextFreeDay`) — preserve these when editing:

- No hard run the day after a legs/hard day.
- Long run is not scheduled the day after legs.
- Hard sessions carry `isHard: true`; leg strength days carry `isLegs: true`. These flags are what the conflict checks read, so any new workout type must set them correctly.

Triathlon race types (`*_tri`) additionally: auto-add missing sports and apply `CONFIG.TRIATHLON_VOLUMES` during onboarding, and insert a weekend Brick in build/peak (which consumes one rad + one lauf slot).

Paces come from `calculatePaces(data)` — race goal time ÷ distance, then `CONFIG.PACE_OFFSETS` in sec/km per zone. This is deliberately pragmatic, not VDOT. Without a PB/goal it falls back to `CONFIG.DEFAULT_EASY_PACE_SEC` by experience level.

## Onboarding

`ONBOARDING_STEPS` is a flat array of step names; `renderOnboarding()` is one long if/else over it. `nextStep()`/`prevStep()` walk the array and skip any step for which `shouldSkipStep()` returns true (currently `race_setup` unless the goal is a race). To add a conditional step, add it to the array *and* to `shouldSkipStep()` — both, or navigation breaks.

The plan is built in the `generating` step, not on the final screen.

## Backward compatibility

Users have persisted state from older versions, so `loadState()` migrates on read: flat single-week plan → week array, missing `trainingDays`, missing `race`. Two related rules:

- Keep the legacy workout-type keys (`long`, `intervall`, `z2`, `tempo`) in `createLaufWorkout()` and the legacy `LAUF_*` entries in `CONFIG.WORKOUT_DURATIONS`. Old `workoutLogs` reference workout IDs built from them.
- Don't change workout `id` formats (`kraft-{day}`, `lauf-{type}-{day}`) — logs are keyed by them.

Corrupt state is handled by clearing storage and restarting onboarding rather than crashing.

## Git

Work on feature branches off `main` and open a PR; the repo history uses German Conventional-Commit subjects (`feat(plan): …`, `fix: …`).
