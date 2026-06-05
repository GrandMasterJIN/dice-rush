# AI-Assisted Development Methodology
## How Dice Rush Was Built with Claude

_Author: Eugene Korshunovich (Ievgen Korshunovych)_
_Project: Dice Rush — Sessions 1–39, March–June 2026_

---

## Overview

Dice Rush was built across 39+ sessions using a structured AI-assisted development methodology. Every line of production code was written by Claude (Anthropic), directed and reviewed by a human product owner with a PM/PO/BA background and foundational coding knowledge.

This document describes what that process looked like in practice — what worked, what didn't, and what it means for software development going forward.

---

## The Setup

**Human role:** Product owner, architect, decision-maker, reviewer, implementer
**AI role:** Engineer — writes all code, proposes solutions, flags risks, maintains context

The human never writes production code directly. The AI never makes product decisions unilaterally.

This is not "AI autocomplete." It is closer to working with a senior engineer who is extremely fast, has no ego, never gets tired, but has no persistent memory between sessions and cannot run or test code in the actual environment.

---

## Session Structure

Each session follows a consistent pattern:

### 1. Context Loading
Every session starts by attaching:
- `session_log.md` — full session history, decisions, next steps
- `master_index.md` — document registry, source code map, locked decisions
- Relevant planning docs for the day's work

Without this, the AI has no memory of prior sessions. The context system is what makes continuity possible.

### 2. Orientation
The AI reads the context and confirms the current state — what exists, what was last changed, what's next. This surfaces inconsistencies between planned and actual state early.

### 3. Planning Before Code
For any non-trivial change, the AI proposes a plan before writing code: which files change, what logic changes, any risks or dependencies. The human approves, redirects, or refines. Code only starts after alignment.

This step is the single biggest quality lever. Skipping it leads to surprises mid-implementation.

### 4. Implementation
The AI writes code in targeted, reviewable chunks. Each change is confirmed before moving to the next. For complex features, the AI reads the relevant file sections immediately before editing — not relying on memory of earlier reads.

### 5. Session Log
At the end of every session, the AI writes a structured log entry covering: what changed, which files, key decisions, and next steps. This becomes the context for the next session.

---

## What the AI Is Good At

### Speed on known patterns
Boilerplate, wiring, CSS, event handlers, test cases — the AI writes these faster than any human and gets them right on the first try most of the time.

### Holding the full codebase in context
Within a session, the AI can reason across multiple files simultaneously — "this change in `main.js` will conflict with the handler in `auth.js` because..." — in a way that would require significant mental overhead for a human.

### Documentation
The AI produces thorough, well-structured documentation quickly. Architecture docs, session logs, planning docs — these improve in quality when the AI writes them because it has full context and no incentive to be lazy.

### Catching its own mistakes
When asked to verify something ("read the file before you edit"), the AI reliably catches discrepancies between what it remembers and what's actually in the file. This habit — read-before-edit — prevents a significant class of bugs.

### Explaining tradeoffs
The AI is useful as a thinking partner for decisions: "should we use a floating overlay or a nameplate swap for bot dialogue?" It surfaces tradeoffs clearly without having a stake in the outcome.

---

## What the AI Is Not Good At

### Remembering across sessions
The AI has no persistent memory. Every session starts from zero. Without a robust context system, it will confidently describe the current state of the codebase based on stale session memory — and be wrong.

The fix: load context at the start of every session, and be sceptical of any claim the AI makes about current file state that it hasn't verified by reading.

### Running in your environment
The AI cannot run the dev server, open a browser, or observe actual behaviour. All feedback about whether something works comes from the human after testing. This means bugs that only manifest at runtime (physics timing, CSS layout on a specific device) require human description to diagnose.

### Product judgment
The AI will implement what it's asked to implement. It will flag obvious problems, but it won't tell you that a feature is the wrong thing to build. That judgment belongs to the human.

### Knowing when to stop
Left to its own instincts, the AI tends toward completeness — implementing every edge case, adding every guard, writing every comment. This is usually good but occasionally produces over-engineered solutions to simple problems. The human needs to scope the work clearly.

---

## Failure Modes Encountered

### Context drift
In longer sessions, early file reads become stale. The AI edits based on what it remembers the file looking like, not what it currently looks like. **Fix:** Re-read files immediately before any edit. Established as a working rule from Session 10 onward.

### Phantom features
Several times, the AI referred to features as "already implemented" based on planning documents, when the actual implementation hadn't happened yet. **Fix:** The session log explicitly distinguishes planned vs implemented. The AI is trained to verify against actual file contents, not planning docs.

### MCP tool reliability
The Filesystem MCP tool occasionally times out or fails silently (especially `edit_file` with emoji in `oldText`). **Fix:** Use `write_file` for full rewrites when `edit_file` behaves unexpectedly. Restart Claude Desktop to recover from MCP timeouts.

### Scope creep in implementation
Asked to fix one thing, the AI sometimes "improves" adjacent code it notices. **Fix:** Explicit scoping — "change only these three things" — and reviewing diffs carefully before accepting.

---

## Context System Design

The context system is the infrastructure that makes multi-session AI development viable.

### Files

| File | Purpose |
|------|---------|
| `context/logs/session_log.md` | Full history — decisions, changes, next steps per session |
| `context/documentation/master_index.md` | Document registry, source code map, locked decisions, open questions |
| `context/documentation/technical_overview.md` | Architecture reference for new sessions |
| Planning docs | Specific feature plans — read when relevant, not every session |

### Rules

- `session_log.md` is **always appended**, never replaced
- `master_index.md` is updated whenever a new document is created or a decision is locked
- New source files are registered in `master_index.md` immediately
- Locked decisions are never revisited without explicit discussion

### What Makes It Work

The key insight is that the context system compensates for the AI's lack of persistent memory by externalising that memory into structured files. The human maintains the files; the AI reads them. Neither party holds state in their head across sessions.

---

## Collaboration Model

The human and AI have distinct domains:

**Human owns:**
- Product vision and priorities
- Go/no-go on every design decision
- Testing in the actual environment
- Anything involving real users, real accounts, or real infrastructure

**AI owns:**
- All code authoring
- Technical plan proposals
- Risk identification
- Documentation
- Session logging

**Shared:**
- Architecture decisions (AI proposes, human approves)
- Debugging (AI diagnoses from human-described symptoms)
- Feature scoping (negotiated per session)

---

## Velocity

Over 39 sessions of roughly 1–2 hours each, this methodology produced:

- A complete 3D dice physics engine (Three.js + Rapier)
- A full game state machine with 10+ special states
- Supabase auth + persistence
- A three-mode onboarding/tutorial system
- A bot character system with two distinct personalities and 11 dialogue triggers each
- A responsive UI (desktop + mobile) in a back-room casino aesthetic
- 159 unit tests
- A full QA pass (95/96)
- Production deployment on Vercel
- This documentation

The equivalent staffed project — assuming a junior developer — would have taken significantly longer and produced less consistent code quality. The methodology is not magic, but the speed advantage on implementation tasks is real and substantial.

---

## What This Means for Product Managers

This methodology is particularly suited to PMs and POs because it maps naturally to existing skills:

- **Writing requirements** → writing session plans and scoping instructions
- **Grooming a backlog** → maintaining `session_log.md` next steps
- **Running a sprint** → running a session with a clear scope
- **Code review** → reviewing AI-generated diffs before applying
- **Stakeholder communication** → the documentation the AI produces

The barrier is not coding knowledge — it's system thinking and discipline. A PM who can write a precise brief, review a diff, and maintain a context system can build production software with this methodology.

The constraint is that you must understand enough about the code to review it. You don't need to write it, but you do need to catch it when it's wrong.

---

## Recommendations for Others

1. **Invest in your context system before you invest in features.** A good `session_log.md` discipline from session 1 pays dividends for the entire project.

2. **Always plan before code.** Ask the AI to describe what it's going to change before it changes anything. This catches misalignments early when they're cheap to fix.

3. **Read before edit.** Require the AI to read the relevant file section immediately before editing it. Not from memory — from the actual file.

4. **Keep logic modules pure.** Modules like `gameState.js` and `scoring.js` that are testable in isolation are the foundation of quality in an AI-assisted codebase. The AI writes tests for them; the tests catch regressions when the AI makes mistakes.

5. **Log decisions, not just changes.** The most valuable entries in `session_log.md` are the ones that capture *why* a decision was made, not just what changed. Future sessions (and future you) will need the reasoning.

6. **The AI is not your QA.** It cannot run the code. Every session ends with human testing in the actual environment. There is no substitute.
