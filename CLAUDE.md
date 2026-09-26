# Ink Nine: notes for Claude Code

Ink Nine is a minimal mobile golf game drawn like a paper-and-ink cartoon. It is live at https://www.inknine.golf and is being played by testers right now.

## Who you're working with
Otis is the designer. He doesn't read code. He judges changes by playing them on his phone.
- Explain every change in plain language: what the player will see and feel, not how the code works.
- After pushing a branch, give Otis the Vercel preview link so he can play it before it goes live.
- Keep replies short. Ask one question at a time when a design decision is his to make.

## How the project is built
- **No build step, no frameworks, no npm packages in the game.** Plain HTML, CSS and JavaScript files served as-is by Vercel. The only outside code is Supabase's client, loaded from a CDN when online play starts, plus Google Fonts.
- `index.html` — the front page (animated course and Play button).
- `play/index.html` — the game page. It loads `styles.css` and then the scripts in `play/js/` **in the order listed there**.
- The scripts are classic scripts that share one global scope. Order matters: a file can only use things defined in files above it *while it is loading*. Calls that happen later (on tap, per frame) can use anything.
- `play/js/config.js` — `VERSION` and the Supabase URL and publishable key. The key is public by design. **Never add a Supabase secret or service key anywhere.**
- `manifest.webmanifest`, `sw.js`, `icons/`, `og-image.png` — home-screen install and share previews. When you change files the service worker caches, bump `CACHE` in `sw.js`.
- `supabase/` — SQL files Otis runs by hand in the Supabase SQL Editor, numbered in order.

| File | What's in it |
|---|---|
| engine.js | Physics constants, clubs, surfaces, ball flight, shapes |
| courses.js | All 30 holes (Meadowbrook, Saltmarsh Links, Crownwood, Practice Green), terrain, slopes |
| run.js | Upgrades, curses, twists, invitationals, rivals, pro shop data, saved progress (`meta`), game state `S` |
| render.js | Canvas, ink patterns, camera |
| ui.js | HUD, club chips, callouts, reward cards |
| online.js | Friends, ghost balls, leaderboard (Supabase outside Claude) |
| screens.js | Trophies, name screen, clubhouse, pro shop, feedback, starting an event |
| rounds.js | Save and resume, tutorial coach, between-hole cards |
| audio.js | Procedural sound effects |
| flow.js | Hole flow: aim, shoot, penalties, holing out |
| points.js | Shot points, streaks, hole multipliers |
| physics.js | Per-step flight, bounces, rolling, trees, cup |
| input.js | Swing drag, curve, tempo ring, strike dial, telescope |
| draw.js | Drawing everything on the course |
| main.js | Main loop and startup (always last) |

## Every change
1. Work on a new branch, never directly on `main`.
2. Bump `VERSION` in `play/js/config.js` (patch for fixes, minor for features) and add a line to `CHANGELOG.md` in plain language.
3. Test locally: run `python3 -m http.server` in the repo folder and open http://localhost:8000/play/ at a phone size (390 × 844). Online play only works on https, so it will say it's offline locally; that's expected.
4. Push the branch and share the Vercel preview link with Otis. Merge to `main` only when he's happy.

## Protect testers' saved progress
Testers keep progress in their browser's localStorage. An update must never wipe or break it.
- Keys: `inknine-meta` (wallet, unlocked clubs, upgrade levels, name, group, tutorial), `inknine-run` (round in progress), `inknine-trophies`, `inknine-bests`.
- Never rename or remove a saved field. Add new fields with defaults in `migrateMeta()` in run.js. If a field's meaning changes, bump `META_SCHEMA` and convert old data there.
- The round-in-progress snapshot (`saveRun` / `resumeRun` in rounds.js) has `v:1`. If you change its shape, bump `v` and make `loadRun()` ignore or convert older snapshots.
- Changing a hole's layout mid-test is fine, but mention to Otis that anyone paused on that hole will resume on the new layout.

## Supabase
- Tables: `rounds` (best rounds and in-progress rounds per player and invitational, used for ghosts and the leaderboard) and `feedback` (tester notes; readable only in the Supabase dashboard).
- Players are anonymous Supabase users. Row-level security lets each player write only their own rows.
- Any schema change needs a new numbered file in `supabase/` and a clear note to Otis to run it before merging.

## Look and feel (keep it consistent)
- Paper and ink only: white `#fff` and black `#000`, with grey only for secondary text. Shading is hatching and stippling, never color.
- Fonts: Fraunces (display, often italic 900) and Figtree (UI).
- Motion follows Disney's principles: squash and stretch, anticipation, follow-through, slow in and out.
- Mobile first, portrait, one thumb. Respect safe areas and `prefers-reduced-motion`.
- Writing: sentence case, short and plain, no jargon.

## Smoke test before sharing a preview
- Name screen, then the clubhouse shows the version and "Send feedback".
- Tutorial: the coach appears and advances after a shot.
- Meadow hole 1: swing, curve, pure strike, putt out; the between-hole card shows the leaderboard and rewards.
- Refresh mid-hole: the round resumes with "Welcome back".
- Pro shop: buying an upgrade updates the wallet and pips.
- No errors in the browser console.
