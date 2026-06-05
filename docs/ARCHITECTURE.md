# Dice Rush — Architecture

_Audience: developers, technical reviewers, conference/portfolio readers_

---

## Overview

Dice Rush is a browser-based dice game built on a deliberately minimal stack. The core design principle: **this is a game, not a web app** — so the architecture prioritises game loop control and physics fidelity over component reusability or declarative rendering.

The result is a ~1600-line vanilla JS orchestration layer driving a Three.js/Rapier physics engine, a pure functional game state machine, and a Supabase backend — all without a single frontend framework.

---

## Why Vanilla JS Instead of React

The most common question about this stack.

React optimises for DOM diffing and declarative re-renders. That mental model is wrong for a game loop. The core rendering cycle in Dice Rush is:

```
physics tick → read die orientations → update Three.js meshes → render frame
```

React has no useful role in that loop. Adding it would mean either bypassing React entirely for the physics/3D layer (defeating the purpose) or fighting React's reconciler on every frame update.

Vanilla JS gives direct, unmediated control over the game loop, animation timing, and DOM state — at the cost of more manual DOM management for UI panels like the lobby and comms panel. That trade-off is correct for this use case.

---

## Module Map

```
┌─────────────────────────────────────────────────────────┐
│                       index.html                         │
│                (static DOM shell only —                  │
│                 no logic, no dynamic content)            │
└────────────────────────┬────────────────────────────────┘
                         │ getElementById / querySelector
┌────────────────────────▼────────────────────────────────┐
│                       main.js                            │
│                  Orchestration Layer                     │
│                                                          │
│  • Event handlers (Roll, Bank, Lock, UI buttons)         │
│  • Turn flow controller (human ↔ bot)                    │
│  • Render functions (scales, comms panel, dice display)  │
│  • Auth state management                                 │
│  • Tutorial hook calls                                   │
│  • Bot dialogue trigger calls                            │
└──┬────────┬────────┬────────┬────────┬──────────────────┘
   │        │        │        │        │
   ▼        ▼        ▼        ▼        ▼
game     scoring   bot.js  botChar  dice3d.js
State.js  .js              acter.js
           │                        │
    source of truth          Three.js + Rapier
    for all scoring          physics world
    copy and point
    values
```

### Data Flow — Human Turn

```
User clicks Roll
  → main.js calls processRoll(game, lockedIndices) [gameState.js]
  → new game state returned
  → main.js calls animateDice(lockedIndices, finalValues, callback) [dice3d.js]
    → Rapier physics runs until settled
    → face orientations read from quaternions
    → Three.js meshes updated
    → callback fires with face values
  → main.js renders scales, comms panel, dice display
  → main.js checks for hot dice, bust, autowin, barrel
  → UI enabled/disabled based on new state
```

### Data Flow — Bot Turn

```
main.js schedules bot action (setTimeout)
  → main.js calls botDecision(game, difficulty) [bot.js]
  → returns 'roll' or 'bank'
  → if 'roll': same path as human roll
  → if 'bank': main.js calls bankTurn(game) [gameState.js]
  → main.js calls showBotLine(trigger) [botCharacter.js via main.js]
  → dialogue displayed on nameplate overlay
```

---

## Game State Machine

`gameState.js` is the authoritative source for all game rules. It exports pure functions — each returns a new state object, never mutating in place.

```js
createGame(playerName, difficulty)  → game
processRoll(game, lockedIndices)    → game
bankTurn(game)                      → game
endTurnOnly(game)                   → game
```

### Why Pure Functions

Testability. Every game rule is independently unit-testable with no DOM, no physics, no network. The 65 `gameState.test.js` tests cover turn flow, pit/barrel/bolt rules, overtake logic, and edge cases — all without a browser.

### State Shape

```js
{
  players: [
    {
      name, score, isOpen, bolts,
      isOnBarrel, barrelAttempts, barrelFalls
    }
  ],
  currentPlayerIndex: 0 | 1,
  winner: null | 'Human' | 'Bot',
  turn: {
    phase, diceValues, lockedIndices,
    turnScore, hotDice, _autowin
  }
}
```

---

## Physics Architecture

### Why Rapier

Rapier (`@dimforge/rapier3d-compat`) replaced Cannon-es in Session 20. The core problem with Cannon-es was unreliable face detection — quaternion reads at rest were inconsistent, making it hard to determine which face was up after a roll.

Rapier provides:
- Deterministic physics via WASM
- Accurate quaternion values at rest
- Better performance at scale

### Face Detection

Dice faces are determined by comparing the die's resting quaternion against six reference orientations (one per face). The closest match by dot product wins.

```js
// Simplified
const up = new THREE.Vector3(0, 1, 0);
up.applyQuaternion(dieQuaternion);
// Match up vector to face normals → face value
```

### Physics ↔ Rendering Split

Rapier runs headlessly. Three.js is purely visual. On each physics tick, die rigid body positions/rotations are read and applied to Three.js mesh transforms. This clean separation means the visual layer never influences the physics simulation.

---

## Bot AI

Two difficulty levels, two decision functions in `bot.js`.

### Easy Bot

Banks at `turnScore >= 50`. Deliberately naive — makes the game accessible and gives beginners a chance.

### Hard Bot

Uses expected value calculation:

```
EV(roll) = P(score) × (currentTurnScore + expectedNewScore)
         - P(bust) × currentTurnScore
```

Factors in:
- Number of active (unsettled) dice remaining
- Current turn score vs banking threshold
- Whether player is in a pit (more conservative)
- Barrel state (more aggressive — needs exact 1000)

When `EV(bank) > EV(roll)`, the bot banks.

---

## Bot Character System

Characters are decoupled from game logic entirely. `botCharacter.js` is a pure data + lookup module.

```js
getBotCharacter('easy')   // → Teddy Ash
getBotCharacter('hard')   // → Constance Hale
getBotLine(character, 'busting')  // → random line from trigger pool
```

### Dialogue Display Architecture

Rather than a floating overlay (z-index management complexity) or a comms panel zone (hidden on mobile), dialogue replaces the bot's nameplate temporarily:

- **Desktop:** `#scale-bot-dialogue` div sits `position: absolute` over `#scale-bot-top-tag`. Nameplate fades to opacity 0, dialogue fades in, holds 3.2s, reverts.
- **Mobile:** `#strip-bot-dialogue` row expands below the bot strip via `max-height` transition, then collapses.

This approach works at every viewport width with no z-index conflicts and no additional layout space required.

### Silence Chance

Not every trigger fires a line — Teddy speaks 75% of the time, Constance 55%. This keeps dialogue feeling natural rather than exhausting.

---

## Auth + Persistence

Supabase handles auth (email/password), user metadata persistence, and leaderboard score saving.

### User Metadata Pattern

Rather than a separate `user_preferences` table, all lightweight per-user state is stored on Supabase's built-in `user_metadata` JSON field:

```js
{
  username, hints_enabled, tutorial_completed, difficulty
}
```

This avoids extra table round-trips for settings reads — the metadata arrives with the session on page load.

### Known Gotcha

Supabase fires `TOKEN_REFRESHED` auth state change events on silent token refresh. Without handling, this caused phantom logout/login cycles visible to the user. Fixed by explicitly handling `TOKEN_REFRESHED` in `onAuthStateChange` — updates `currentUser` silently with no screen transition.

---

## Tutorial System

Three modes based on user metadata:

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| Tutorial | `tutorial_completed: false` | Full Driver.js coach marks |
| Hints | `tutorial_completed: true, hints_enabled: true` | Comms panel messages, once per session |
| Silent | `hints_enabled: false` | No interruptions |

`tutorial.js` is fully isolated from `main.js` via hook calls:

```js
tutorialHook('game-start')   // main.js calls this
tutorialHook('first-bust')   // tutorial.js decides what to show
```

This means the tutorial system can be tested independently and swapped out without touching game logic.

---

## CSS Architecture

Single `style.css` (~2200 lines), no preprocessor. All colour and spacing defined as CSS custom properties on `:root`.

### Design Language

The visual theme is a back-room social club — dark oak surfaces, brass fittings, ivory dice, deep crimson accents. Every UI element is expressed in this language: barometer scales, brass nameplate badges, oak modal backgrounds.

### Responsive Strategy

Two distinct layouts:

**Desktop (> 480px):** Scale columns flank the dice pit. Brass barometer thermometers show scores vertically. Auth badge and exit button sit top-right.

**Mobile (≤ 480px):** Scale columns are hidden entirely. Two compact horizontal strips replace them at the top — monogram badge, name, bolt pips, score. The dice pit and comms panel fill the remaining space.

This is not a responsive reflow of the same layout — it's two purpose-built layouts for their respective contexts, sharing only the dice pit and comms panel.

---

## Testing Strategy

Unit tests cover the three pure logic modules. Integration and UI testing is manual.

| Layer | Approach |
|-------|---------|
| Scoring rules | Vitest unit tests — all combinations, edge cases |
| Game state machine | Vitest unit tests — full turn flow, all special states |
| Bot decisions | Vitest unit tests — Easy/Hard decision logic |
| Tutorial engine | Vitest unit tests (jsdom) — mode selection, dedup, completion |
| 3D / Physics | Manual — not unit-testable in isolation |
| UI / Layout | Manual — QA test plan (95/96 passing) |

### Test Architecture Constraint

`gameState.js` and `scoring.js` are tested in Node via Vitest. They must never import browser APIs. `tutorial.js` uses `jsdom` via `// @vitest-environment jsdom` and guards all `document` access with `typeof document !== 'undefined'`.

---

## Performance Considerations

- **Bundle size:** Three.js adds ~600kb gzipped. Acceptable for a game; would be reconsidered for a content site.
- **Physics:** Rapier WASM initialisation is async — game start is gated on `await RAPIER.init()`.
- **Bot turn delay:** Artificial `setTimeout` delay on bot actions to prevent instant responses feeling jarring. Tuned to ~800–1200ms depending on action type.
- **Dial animation:** CSS transitions on scale fill bars are GPU-accelerated via `transform` where possible.

---

## What Would Change for Mobile (Unity Port)

The web MVP validates the game concept. A Unity port for iOS/Android would replace:

- Three.js + Rapier → Unity physics + rendering
- Vanilla JS state machine → C# game state
- Supabase JS SDK → Unity Supabase SDK or REST calls
- CSS layouts → Unity UI Toolkit or uGUI

The game logic (rules, scoring, bot AI) is clean enough that `gameState.js` and `scoring.js` serve as a direct specification for the Unity reimplementation — the logic is framework-agnostic.
