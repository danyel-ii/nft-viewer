# Agent Learning Protocol

## What this is
This document is the agent’s long-term memory for this repository.
It records mistakes, how they were fixed, and how to prevent them next time.

**Rule:** if something goes wrong (error, wrong assumption, manual correction), it must be logged here.

## How to use this document (the learning loop)
1) Before coding: skim the most recent entries and the “Prevention Rules”.
2) During coding: when a mistake happens, capture the symptom.
3) After fixing: write an entry with root cause, fix, and prevention.
4) If the same kind of mistake happens again, add a stronger prevention rule (tests, validation, lint/type checks, better defaults).

## Prevention Rules (living checklist)
Add short “never again” rules here when patterns repeat.

- (Example) Always run tests after changing API response shapes.
- (Example) Never assume env vars exist; validate and provide good errors.
- When scaffolding in a capitalized folder, avoid tools that derive npm package names from the directory; scaffold in a lowercase subfolder and move if needed.
- Avoid interactive TUI commands in non-interactive flows (don’t pipe `y\n` into multi-select prompts); prefer config edits or a proper TTY session with deterministic input.
- Coerce possibly-null motion/media booleans (e.g. `useReducedMotion() ?? false`) before passing into DOM boolean props.

---

## Log (newest first)

### 2026-02-10 — Git Branch Commands Failed Because Repo Was Not Initialized
**Task/Context:**  
Create a new git branch named `print` and switch to it for print-view layout work.

**Mistake:**  
Ran `git` branching commands assuming the workspace already had a `.git` directory.

**Symptom / Evidence:**  
`fatal: not a git repository (or any of the parent directories): .git`

**Root cause:**  
The project folder was missing `.git` (it was not initialized as a git repository in this workspace).

**Fix (what we changed):**  
Initialized a git repo and created/switched to the requested branch:
- `git init -b main`
- `git checkout -b print`

**Prevention (so it doesn’t happen again):**  
Before doing any git workflow steps, confirm we’re in a work tree (`git rev-parse --is-inside-work-tree`) or check for `.git/`. If missing, initialize (or explicitly call out the limitation).

**References (files/commands):**  
- Commands: `git status`, `git init -b main`, `git checkout -b print`

**Tags:**  
`workflow`, `git`

### 2026-02-10 — Patch Failed Due To Stale Context While Adding Artist Metadata
**Task/Context:**  
Add `artist` metadata to normalized NFT cards and surface it in the print poster view.

**Mistake:**  
Tried to apply an `apply_patch` hunk with context lines that no longer matched the file.

**Symptom / Evidence:**  
`apply_patch verification failed: Failed to find expected lines in src/lib/normalize.ts`

**Root cause:**  
The file had changed since the patch context was drafted, so the exact surrounding lines didn’t match.

**Fix (what we changed):**  
Re-opened the file with line numbers, then re-applied a patch with correct, current context.

**Prevention (so it doesn’t happen again):**  
When editing frequently-changed files, grab fresh context (`nl -ba ...`) right before writing a patch, and keep hunks small.

**References (files/commands):**  
- Files: `src/lib/normalize.ts`
- Commands: `nl -ba src/lib/normalize.ts`

**Tags:**  
`workflow`, `editing`

### 2026-02-10 — Deck “Next” Animation Teleported When The Moving Card Became The Back Card
**Task/Context:**  
Make the deck navigation feel physical: the top card must move fully off the stack, then slide behind the deck.

**Mistake:**  
Animated the moving card using deltas that didn’t account for the card’s depth changing from top (`depth=0`) to back (`depth=last`) mid-animation.

**Symptom / Evidence:**  
User feedback: animation “not realistic”; the card appeared to jump/teleport when entering the “behind” phase.

**Root cause:**  
When `activeIndex` advances, the moving card is re-rendered at a different stack depth, which changes its base `x/y/z/scale/rotateZ` offsets. Without compensating for those base offsets, the motion target shifts abruptly.

**Fix (what we changed):**  
Defined phase targets in “absolute” space and computed per-depth deltas that cancel the stack’s base offsets for the moving card (including scale), plus measured the deck container size to pick a consistent off-stack distance.

**Prevention (so it doesn’t happen again):**  
When animating an element across depth/layer changes, either:
1) Keep it in an overlay layer for the duration of the motion, or
2) Cancel base stack offsets so phase targets stay stable even if depth changes.

**References (files/commands):**  
- Files: `src/components/TradingCardDeck.tsx`, `src/components/NftDeckApp.tsx`

**Tags:**  
`ui`, `animation`, `react`

### 2026-02-10 — Poster View Failed To Find The Selected NFT Due To ID Encoding / TokenId Formatting
**Task/Context:**  
Add a print-friendly poster view (`/print`) for the current top NFT.

**Mistake:**  
Looked up the poster NFT using strict `id` string equality without guarding against URL encoding or tokenId format differences (hex vs decimal / leading zeros).

**Symptom / Evidence:**  
Poster page sometimes showed: “Poster unavailable: That NFT was not found for this wallet/network.”

**Root cause:**  
Query params may arrive encoded, and upstream APIs can represent `tokenId` differently. A strict `id` string match can fail even when the token is present.

**Fix (what we changed):**  
- Safely decoded `wallet`/`id` query params on the print route.  
- Added fallback matching by `(contractAddress, tokenId)` with tokenId normalization.  
- Canonicalized token IDs to base-10 in the normalization layer and added tests.

**Prevention (so it doesn’t happen again):**  
Canonicalize `tokenId` as early as possible (normalization layer) and decode/normalize URL inputs before using them as identifiers. Add focused tests whenever identifier formats change.

**References (files/commands):**  
- Files: `src/app/print/page.tsx`, `src/components/PrintPoster.tsx`, `src/lib/normalize.ts`, `src/lib/normalize.test.ts`

**Tags:**  
`ui`, `print`, `data`, `types`

### 2026-02-10 — `pnpm start -- -p 3010` Failed Because `next start` Treats `--` Args As A Directory
**Task/Context:**  
Start the production server on an alternate port to test new deck sizing and poster view.

**Mistake:**  
Tried to pass port arguments through `pnpm start` using `-- -p 3010`.

**Symptom / Evidence:**  
`Invalid project directory provided, no such directory: /Users/danyel-ii/Documents/Vibes/-p`

**Root cause:**  
Our `package.json` script was `next start` with no args. `next start` CLI expects the first positional argument to be a directory, so passing `-- -p` via pnpm ended up being interpreted as a directory name.

**Fix (what we changed):**  
- Used `pnpm exec next start -p 3010` for the immediate test.
- Updated `package.json` `start` script to use `PORT` (`next start -p ${PORT:-3000}`) for easier port overrides.

**Prevention (so it doesn’t happen again):**  
Prefer `PORT=3010 pnpm start` (or `pnpm exec next start -p 3010`) instead of passing `-p` through `pnpm start -- ...`.

**References (files/commands):**  
- Files: `package.json`
- Commands: `pnpm start -- -p 3010`, `pnpm exec next start -p 3010`

**Tags:**  
`dev`, `workflow`

### 2026-02-10 — Next/Prev Animation Needed The “Moving Card” To Stay Mounted
**Task/Context:**  
Add a deck browsing animation where the top card lifts out and slides into the back (Next/Prev).

**Mistake:**  
Initially changed the “current card” (`activeIndex`) during the animation without ensuring the old top card stayed in the rendered `cards[]`.

**Symptom / Evidence:**  
The moving card would “pop” or disappear mid-cycle (because React unmounted it when the visible slice changed).

**Root cause:**  
The deck only renders the top N cards. When `activeIndex` changes, the previously-top card can drop out of that visible slice immediately unless it’s deliberately kept in the render list during the transition.

**Fix (what we changed):**  
Introduced a `cycle` state and a derived `deckCards` list that temporarily keeps the moving card mounted (appends it for the “drop” phase) so Framer Motion can animate it into the back.

**Prevention (so it doesn’t happen again):**  
For animated list transitions, ensure the transitioning item remains mounted across intermediate state updates (especially when rendering a limited “window” of a larger list).

**References (files/commands):**  
- Files: `src/components/NftDeckApp.tsx`, `src/components/TradingCardDeck.tsx`

**Tags:**  
`ui`, `animation`, `react`

### 2026-02-10 — ESLint `exhaustive-deps` Warnings From Effect That Syncs A Ref
**Task/Context:**  
Keep a global `keydown` handler wired to the latest Next/Prev/Flip/Shuffle callbacks without re-registering the event listener.

**Mistake:**  
Used a `useEffect` that depended on non-memoized handler functions, which triggered `react-hooks/exhaustive-deps` warnings.

**Symptom / Evidence:**  
`pnpm lint` produced warnings about changing dependencies for the effect that updated `handlersRef`.

**Root cause:**  
Functions defined inline change identity each render. Depending on them in an effect creates noisy warnings (and can cause repeated effects if not careful).

**Fix (what we changed):**  
Updated `handlersRef.current = { prev, next, flip, shuffle }` directly during render (safe for refs), and kept the `keydown` listener effect with an empty dependency array.

**Prevention (so it doesn’t happen again):**  
When you need a global event listener that calls “latest” callbacks, prefer storing callbacks in a ref that you update during render (or memoize callbacks with `useCallback`).

**References (files/commands):**  
- Files: `src/components/NftDeckApp.tsx`
- Commands: `pnpm lint`

**Tags:**  
`lint`, `react`, `ui`

### 2026-02-09 — Deck Looked Blank Because Container Had No Height
**Task/Context:**  
Fix “NFTs load but images don’t show” in the Bauhaus framed layout.

**Mistake:**  
Assumed the issue was a Chrome 3D/compositing or image loading problem, and spent time debugging media proxy + `onLoad` behavior before validating basic layout sizing.

**Symptom / Evidence:**  
The API returned NFTs and the right-side panel showed correct metadata (e.g. “LESS 55 / Cards 85”), but the deck area appeared blank/white in Chrome.

**Root cause:**  
`TradingCardDeck` was embedded with `className="h-full w-full"` inside a fixed aspect-ratio frame, but the component’s outer wrapper didn’t also fill height. Because the deck’s children are positioned `absolute`, the wrapper could collapse to 0 height, making the “visible” cards effectively not render in the frame.

**Fix (what we changed):**  
Made the `TradingCardDeck` outer wrapper fill its parent by adding `h-full w-full`.

**Prevention (so it doesn’t happen again):**  
When a component is meant to be “fill parent” and uses absolutely positioned layers, ensure the outer wrapper also has an explicit size (or a `min-height`) so it can’t collapse.

**References (files / commands):**  
- Files: `src/components/TradingCardDeck.tsx`

**Tags:**  
`ui`, `css`, `layout`

### 2026-02-09 — Dev Server Failed To Start Due To Existing Lock File
**Task/Context:**  
Iterating on UI fixes while `pnpm dev` was already running.

**Mistake:**  
Tried to start a second dev server instance.

**Symptom / Evidence:**  
Dev startup failed due to a `.next/dev/lock` conflict (Next/Turbopack dev lock).

**Root cause:**  
Next.js dev server uses a lock file to prevent multiple concurrent instances in the same project directory.

**Fix (what we changed):**  
Kept a single `pnpm dev` instance running (or stopped the existing one before starting another).

**Prevention (so it doesn’t happen again):**  
Before running `pnpm dev`, check whether port `3000` is already in use and avoid starting a second instance.

**References (files / commands):**  
- Commands: `pnpm dev`, `lsof -nP -iTCP:3000 -sTCP:LISTEN`

**Tags:**  
`dev`, `workflow`

### 2026-02-09 — ESLint Blocked `setState` Inside Effect Body
**Task/Context:**  
Fix NFT images not appearing in the 3D deck by adding loading fallbacks and a media proxy.

**Mistake:**  
Reset `imgLoaded` using `setState(false)` directly inside a `useEffect` body.

**Symptom / Evidence:**  
`pnpm lint` failed with `react-hooks/set-state-in-effect` in `src/components/TradingCard.tsx`.

**Root cause:**  
Used an effect to “derive” UI state from props (`mediaUrl`) instead of deriving it in render.

**Fix (what we changed):**  
Replaced `imgLoaded` boolean with `imgLoadedUrl` and derived `imgLoaded` as `imgLoadedUrl === mediaUrl`, eliminating the effect.

**Prevention (so it doesn’t happen again):**  
Avoid setting React state synchronously in effect bodies; prefer deriving values from props/state during render, or update state in callbacks (`onLoad`, `onError`, timers).

**References (files / commands):**  
- Files: `src/components/TradingCard.tsx`
- Commands: `pnpm lint`

**Tags:**  
`lint`, `react`, `ui`

### 2026-02-09 — Typecheck Failed After Adding Unsupported DOM Prop To `<video>`
**Task/Context:**  
Improve NFT media rendering reliability in the deck (eager image loading + safer animation handling).

**Mistake:**  
Added `referrerPolicy` to a `<video>` element even though the TypeScript DOM typings for `VideoHTMLAttributes` do not include that prop.

**Symptom / Evidence:**  
`pnpm typecheck` failed with `TS2322` complaining that `referrerPolicy` does not exist on `VideoHTMLAttributes<HTMLVideoElement>` in `src/components/TradingCard.tsx`.

**Root cause:**  
Assumed the same attribute support across `<img>` and `<video>` without verifying DOM typings.

**Fix (what we changed):**  
Removed the `referrerPolicy` prop from the `<video>` element (kept it on `<img>`).

**Prevention (so it doesn’t happen again):**  
When adding new DOM attributes, verify they exist on the element’s TS attribute type (or check MDN), and run `pnpm typecheck` immediately after UI prop changes.

**References (files / commands):**  
- Files: `src/components/TradingCard.tsx`
- Commands: `pnpm typecheck`

**Tags:**  
`types`, `ui`, `typecheck`

### 2026-02-09 — ESLint Failed On `any` In JSON Error Parsing
**Task/Context:**  
Rewire `/api/nfts` from GoldRush to Alchemy NFT API.

**Mistake:**  
Used `as any` when parsing an upstream JSON error body, and left an unused `eslint-disable` directive.

**Symptom / Evidence:**  
ESLint: `Unexpected any. Specify a different type` and `Unused eslint-disable directive` in `src/lib/alchemy.ts`.

**Root cause:**  
Quick error parsing path bypassed the repo’s TypeScript ESLint rules.

**Fix (what we changed):**  
Parsed JSON into `unknown` and extracted `message`/`error` via safe `Record<string, unknown>` indexing.

**Prevention (so it doesn’t happen again):**  
When parsing JSON from unknown sources, always parse to `unknown` and narrow with type checks before reading fields.

**References (files / commands):**  
- Files: `src/lib/alchemy.ts`
- Commands: `pnpm lint`

**Tags:**  
`lint`, `types`, `api`

### 2026-02-09 — Deck Footer Label Broke Fixed-Frame Layout
**Task/Context:**  
Restyle the app to a Bauhaus-style framed layout where the deck sits inside a fixed 3:4 “art frame”.

**Mistake:**  
Placed `TradingCardDeck` inside a fixed-height container without accounting for its built-in footer label (`Viewing: …`), which would push layout height or overflow the frame.

**Symptom / Evidence:**  
Design review: the deck component includes a bottom label, so embedding it in a strict frame would cause unwanted overflow/extra height.

**Root cause:**  
`TradingCardDeck` owned its footer label with no way to disable it for embedded layouts.

**Fix (what we changed):**  
Added `showLabel?: boolean` to `TradingCardDeck` and passed `showLabel={false}` from `NftDeckApp` (the panel already shows the active card info).

**Prevention (so it doesn’t happen again):**  
When building reusable UI components, make optional sub-sections (like footers) controllable via props, especially if the component might be used inside a constrained layout.

**References (files / commands):**  
- Files: `src/components/TradingCardDeck.tsx`, `src/components/NftDeckApp.tsx`

**Tags:**  
`ui`, `a11y`, `layout`

### 2026-02-09 — Destructive Cleanup Command Blocked By Policy
**Task/Context:**  
Re-run scaffolding after experimenting with a temporary `web/` directory.

**Mistake:**  
Tried to chain a destructive cleanup (`rm -rf web`) into the scaffolding command.

**Symptom / Evidence:**  
Command execution was rejected as “blocked by policy”.

**Root cause:**  
The command included `rm -rf`, which is treated as a high-risk destructive operation by the execution policy.

**Fix (what we changed):**  
Ran scaffolding without destructive cleanup, and used non-destructive moves / `rmdir` once the directory was empty.

**Prevention (so it doesn’t happen again):**  
Avoid `rm -rf` in automated flows; use unique temp directories or safe removal patterns (`rmdir` for empty dirs).

**References (files / commands):**  
- Commands: `rm -rf web && pnpm dlx create-next-app ...`

**Tags:**  
`build`

### 2026-02-09 — create-next-app Failed In Root Folder
**Task/Context:**  
Scaffold a Next.js + Tailwind app in the repo root.

**Mistake:**  
Tried to run `create-next-app` directly in a directory named `Vibes` (capital letters), which caused npm package naming validation to fail.

**Symptom / Evidence:**  
`Could not create a project called "Vibes" because of npm naming restrictions: * name can no longer contain capital letters`

**Root cause:**  
`create-next-app` derives the package name from the directory name, and npm package names must be lowercase.

**Fix (what we changed):**  
Scaffolded into a lowercase subfolder (`web`) with `--skip-install`, then moved the generated project files into the repo root.

**Prevention (so it doesn’t happen again):**  
Follow the prevention rule about scaffolding from a lowercase subfolder when the repo folder name is capitalized.

**References (files / commands):**  
- Commands: `pnpm dlx create-next-app@latest . ...` (failed), `pnpm dlx create-next-app@latest web ... --skip-install` (succeeded)

**Tags:**  
`build`, `docs`

### 2026-02-09 — pnpm approve-builds Used Incorrectly
**Task/Context:**  
Enable dependency build scripts after adding `vitest` (which pulls `esbuild`).

**Mistake:**  
Ran `pnpm approve-builds` in a non-interactive way (piped input), which selected nothing and added `esbuild` to `ignoredBuiltDependencies`.

**Symptom / Evidence:**  
Prompt ended with “No items were selected” and `pnpm-workspace.yaml` included `- esbuild` under `ignoredBuiltDependencies`.

**Root cause:**  
`pnpm approve-builds` is a TUI multi-select; piping `y` doesn’t select items.

**Fix (what we changed):**  
Removed `esbuild` from `pnpm-workspace.yaml`.

**Prevention (so it doesn’t happen again):**  
Avoid TUI commands in non-interactive flows; prefer config edits or a real TTY session where selection is deterministic.

**References (files / commands):**  
- Files: `pnpm-workspace.yaml`
- Commands: `pnpm approve-builds`

**Tags:**  
`build`

### 2026-02-09 — Typecheck Failed Due To Nullable Reduced Motion Hook
**Task/Context:**  
Typecheck the UI components that use Framer Motion.

**Mistake:**  
Passed `useReducedMotion()` (typed as `boolean | null`) into a DOM boolean prop (`<video controls={...} />`) without coercing.

**Symptom / Evidence:**  
`TS2322: Type 'boolean | null' is not assignable to type 'boolean | undefined'.`

**Root cause:**  
Framer Motion’s `useReducedMotion()` can return `null` in its types; DOM boolean props don’t accept `null`.

**Fix (what we changed):**  
Coerced the hook result to a real boolean: `useReducedMotion() ?? false`.

**Prevention (so it doesn’t happen again):**  
Add a quick “DOM props + nullable hook return” mental check and run `pnpm typecheck` early after adding motion/media code.

**References (files / commands):**  
- Files: `src/components/TradingCard.tsx`, `src/components/TradingCardDeck.tsx`
- Commands: `pnpm typecheck`

**Tags:**  
`types`, `ui`

### 2026-02-09 — IPFS URL Normalization Bug Caught By Test
**Task/Context:**  
Normalize NFT media URLs so `ipfs://` and `/ipfs/...` links load in the browser.

**Mistake:**  
Handled `/ipfs/...` by calling `ipfsToHttps(\`ipfs://${s}\`)`, which produced `.../ipfs/ipfs/...` (double `ipfs/`).

**Symptom / Evidence:**  
Vitest failure: received `https://ipfs.io/ipfs/ipfs/QmHash/...` instead of `https://ipfs.io/ipfs/QmHash/...`.

**Root cause:**  
The `/ipfs/` prefix includes a leading slash; turning it into `ipfs:///ipfs/...` bypassed the `ipfs/` prefix stripping logic.

**Fix (what we changed):**  
For `/ipfs/...`, strip the leading slash before converting: `ipfsToHttps(\`ipfs://${s.slice(1)}\`)`.

**Prevention (so it doesn’t happen again):**  
Keep unit tests for common IPFS variants; expand them when new variants appear.

**References (files / commands):**  
- Files: `src/lib/ipfs.ts`, `src/lib/ipfs.test.ts`
- Commands: `pnpm test`

**Tags:**  
`tests`, `ui`, `api`

### YYYY-MM-DD — <short title of mistake>
**Task/Context:**  
(What were we trying to do?)

**Mistake:**  
(What did the agent do wrong?)

**Symptom / Evidence:**  
(Shortest useful error message, stack trace excerpt, or observed wrong behavior.)

**Root cause:**  
(Why it happened. If unsure, write “Hypothesis:” and update later.)

**Fix (what we changed):**  
(Concrete action: code change, config change, command, refactor, revert.)

**Prevention (so it doesn’t happen again):**  
(Add a test, type check, validation, lint rule, checklist item, or doc note.)

**References (files / commands):**  
- Files: `path/to/file.ext`
- Commands: `npm test`, `pytest`, etc.

**Tags:**  
(e.g., `ui`, `api`, `db`, `tests`, `build`, `types`, `docs`, `perf`, `security`)
