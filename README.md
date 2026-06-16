# Dice Rush

A browser-based single-player dice game — a modern reimagining of the Eastern European game Tysicha (1000 points). Race to 1000 points against a bot opponent with strategic banking, risk management, and a cast of back-room social club characters.

**Live:** [dice-rush.vercel.app](https://dice-rush.vercel.app)

---

## The Game

Roll five dice. Score points. Bank before you bust.

Simple in concept, deep in strategy — pits trap you, the barrel forces you to gamble everything on a single roll, and your opponent has opinions about how you play.

### Rules at a Glance

- Bank **50+ points** in one turn to open your score
- Avoid **Pit 1** (200–299) and **Pit 2** (600–699) — you must score your way out
- Reach **880+** and you're on the **Barrel** — one roll to hit exactly 1000 and win
- Three consecutive zero-score rolls earns a **Bolt** penalty (−100 pts on the third)
- Land exactly on **555** and the Dump Truck resets you to zero
- Roll **five 1s** and you can claim an automatic win

---

## Tech Stack

| | |
|--|--|
| **Frontend** | Vanilla JavaScript (ES Modules) |
| **Build** | Vite 5 |
| **3D Rendering** | Three.js (r128) |
| **Physics** | Rapier (`@dimforge/rapier3d-compat`) |
| **Auth + Database** | Supabase |
| **Tutorial** | Driver.js |
| **Testing** | Vitest |
| **Hosting** | Vercel |

---

## Running Locally

```bash
git clone https://github.com/GrandMasterJIN/dice-rush
cd dice-rush/web-mvp
npm install
```

Create a `.env` file in `web-mvp/`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

```bash
npm run dev        # → http://localhost:5173
npm run test       # run unit tests
npm run build      # production build
```

---

## Project Structure

```
web-mvp/
├── index.html              # App shell
└── src/
    ├── main.js             # Game orchestration + UI
    ├── dice3d.js           # 3D dice rendering + physics
    ├── auth.js             # Auth flows
    ├── authModal.js        # Auth UI
    ├── tutorial.js         # Tutorial + hint engine
    ├── sessionLogger.js    # Session event logging
    ├── supabase.js         # Supabase client
    ├── logic/
    │   ├── gameState.js    # Game rules + state machine
    │   ├── scoring.js      # Dice scoring engine
    │   ├── bot.js          # Bot AI
    │   └── botCharacter.js # Bot character identity + dialogue
    └── themes/
        └── style.css       # All styles
```

---

## Further Reading

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical deep-dive
- [`docs/AI_DEVELOPMENT_METHODOLOGY.md`](docs/AI_DEVELOPMENT_METHODOLOGY.md) — how this was built with AI assistance

---

## Status

**Completed and open sourced.** This project ran as a web MVP from May 2026 over 39 AI-assisted development sessions. Validation testing showed low organic retention — the core dice mechanic worked but lacked the narrative context needed to drive repeat play. Rather than scale, the decision was made to open source the project as a portfolio artifact and document the AI-assisted development methodology.

**What was built:** physics-based 3D dice, Supabase auth and leaderboard, bot opponent with character dialogue, Driver.js tutorial system, 165-test Vitest suite, and full deployment on Vercel.

**What was learned:** mechanics alone don't retain players — context and stakes matter as much as the rules.

---

## Postmortem

### What we set out to do

Validate a web MVP of a dice game rooted in Tysicha — a classic Eastern European card-and-dice game — before committing to a full Unity mobile build. The hypothesis was: if people play it more than once and share it organically, the concept has legs worth scaling.

### What we actually built

Over 39 AI-assisted development sessions across roughly two months, the project grew well beyond a minimal prototype. By the end it had physics-based 3D dice with real orientation-based value reading, a full Supabase auth and leaderboard system, two bot characters with contextual dialogue, a Driver.js tutorial with three user modes, a 165-test Vitest suite, mobile layout, and complete technical documentation. The methodology was deliberately structured — each session had a defined scope, a session log, and handoff context so Claude could resume without losing state.

### What the numbers said

After sharing the game with five people, none returned to play a second time on their own. The database confirmed it: 10 total games, 2 unique users (both the developer and test accounts), active window of 17 days, zero organic signups from external players.

### Why it didn't retain

The honest diagnosis: the mechanic works but there's no meaning layer on top of it. Reaching 1000 points is a rule, not a reason. Without narrative context, stakes, or progression — without an answer to "why should I care if I win?" — one game satisfies curiosity and that's enough. The social layer that makes Tysicha compelling in real life (playing with friends, the drama of the barrel, the trash talk) doesn't survive the translation to solo browser play against a rule-based bot.

Early design concepts pointed toward a meaning layer — a heist narrative, named opponent characters with backstory, a graphic novel panel format. Those ideas were right. We just didn't build them before validating.

### What we'd do differently

Start with the narrative before the mechanics. The characters and context are what make a player come back — the dice rules are just the vehicle. A working story loop with placeholder dice would have been a faster validation than a physics engine with no emotional stakes.

### Why open source

The project is a genuine artifact of an AI-assisted development methodology that worked technically even when the product hypothesis didn't. The session structure, the handoff pattern, the way Claude was used to drive architecture decisions, QA, and documentation — that process is worth sharing. This repo is the output; [`docs/AI_DEVELOPMENT_METHODOLOGY.md`](docs/AI_DEVELOPMENT_METHODOLOGY.md) is the process.

---

## License

MIT — see [LICENSE](LICENSE)
