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

Currently in **Phase 1 MVP** — web validation before potential mobile (Unity) port.

**Validation targets:** 100+ players · 5+ min sessions · 50+ signups

---

## License

Private — all rights reserved.
