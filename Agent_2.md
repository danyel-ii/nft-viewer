# agent_2.md

## Mission
Build a polished, elegant web app that lets a user enter an **Ethereum address or ENS name** and view **all NFTs owned by that public wallet** as a **3D trading-card deck**. The deck must support:
- **Front**: NFT media (image first; optionally video when available)
- **Back**: NFT metadata (collection, token, traits, description, links)
- Controls: **next/prev**, **shuffle**, **flip**
- Network toggle: **Ethereum Mainnet**, **Base**, **Celo**

This is a *read-only* viewer: **no wallet connect** required.

---

## Non‑negotiable: Read & follow repo protocols
Before writing code, open and follow these files (they override any conflicting instructions):
- `AGENTS.md`
- `looking-glass.md`
- `agent-learning-protocol.md`

### Compliance requirements
- Use the repo’s preferred stack, formatting, linting, branching, and commit conventions.
- If instructions conflict, defer to the ordering in `AGENTS.md` (or as specified there).
- Keep changes minimal and aligned with existing patterns.
- Document decisions and assumptions where the protocols require it.

---

## Core product requirements (must-have)
1. **Input**
   - Single input accepts either:
     - `0x...` EVM address
     - ENS name (e.g. `vitalik.eth`)
   - Validation and clear error messaging.
   - If ENS: resolve to an address (server-side or client-side, but must be reliable).

2. **Networks**
   - Toggle between:
     - Ethereum mainnet
     - Base
     - Celo
   - Switching network refetches and rebuilds the deck for that chain.

3. **NFT fetching**
   - Use a server-side API route (to keep API keys private).
   - Use Alchemy NFT API “getNFTsForOwner” endpoint (server-side only):
     - `GET https://{chainName}.g.alchemy.com/nft/v3/{ALCHEMY_KEY}/getNFTsForOwner?owner=...`
   - ChainName mapping:
     - `eth-mainnet`
     - `base-mainnet`
     - `celo-mainnet`
   - Implement a normalization layer that returns a **flat list** of “cards” with:
     - contract address
     - token id
     - collection name
     - token name
     - description
     - image url (best available)
     - animation url (if present)
     - attributes/traits
     - token/explorer URLs if available
   - Handle IPFS URIs: `ipfs://...` → gateway HTTPS URL.
   - Handle missing/broken media gracefully (placeholder card face).

4. **3D trading card deck UI**
   - Deck looks like a physical stack in 3D:
     - perspective + depth offsets for the top N cards
     - subtle rotation/offset variations
   - Top card is interactive:
     - click/tap flips front/back (3D flip)
     - next/prev navigates through deck
     - shuffle randomizes order with animation
   - Responsive layout (desktop + mobile).
   - Accessibility:
     - keyboard navigation (←/→ next/prev, space/enter flip, “S” shuffle)
     - visible focus states
     - honor `prefers-reduced-motion`

5. **UX polish**
   - Loading skeleton/state
   - Empty state (“No NFTs found on this network”)
   - Error state (API errors, invalid ENS/address)
   - Optional: “Hide spam” toggle (default ON when supported)

---

## Technical direction (adapt to repo standards)
### Suggested stack (only if repo doesn’t already dictate one)
- Next.js (App Router) + React + TypeScript
- Tailwind CSS (or existing styling system)
- Framer Motion for deck transitions
- CSS 3D transforms for flip + stack (fast and lightweight)

### Data/API
- Add `ALCHEMY_KEY` as server secret:
  - `.env.local` (ignored)
  - `.env.example` checked in
- ENS resolution requires `RPC_URL` (Ethereum mainnet RPC HTTP URL) server-side.

### Caching / performance
- Avoid rendering hundreds of DOM nodes:
  - render only top ~12 “stack” cards visually
  - keep the rest in data structure
- Add simple request caching per `(chain, address)` (in-memory or Next caching),
  with a short TTL to prevent rate-limit issues.

---

## Implementation plan (do in this order)
1. **Repo discovery**
   - Identify existing framework, package manager, linting, formatting, and test setup.
   - Locate where UI apps live (root, `/apps/web`, etc.).
   - Follow naming and folder conventions.

2. **Scaffold / integrate**
   - If app exists: create a new route/page for NFT deck viewer.
   - If app does not exist: create a web app in the standard repo location.

3. **Server route**
   - `GET /api/nfts?chain=...&wallet=...`
   - Validate chain, normalize wallet input, resolve ENS if needed.
   - Call Alchemy NFT API, flatten response, return:
     - `resolvedAddress`
     - `chain`
     - `count`
     - `cards[]`

4. **Client state & data flow**
   - Form submit triggers fetch.
   - Persist last-used wallet + chain in URL query params (shareable links).
   - Maintain deck state:
     - `order[]` / `cards[]`
     - `activeIndex`
     - `isFlipped`

5. **Deck UI**
   - Components:
     - `WalletSearchBar`
     - `NetworkToggle`
     - `DeckControls` (Prev / Next / Flip / Shuffle)
     - `TradingCardDeck`
     - `TradingCard` (front/back)
   - Ensure 3D effect:
     - `perspective` on container
     - `preserve-3d` on card
     - `backface-visibility: hidden` on faces
   - Use Framer Motion (or repo’s animation library) for:
     - shuffle animation
     - next/prev transitions
     - drag/swipe to advance (optional but nice)

6. **Metadata back**
   - Render metadata in an elegant card-back layout:
     - title, collection
     - contract + token id (copy buttons)
     - traits grid/pills
     - description (clamped with “more”)
     - external links

7. **Quality gates**
   - `lint`, `typecheck`, `tests` (as repo requires)
   - `build` and `dev` run without errors

8. **Documentation**
   - Add a short usage section to the repo’s docs/README:
     - how to run
     - env vars
     - how to fetch NFTs

---

## Acceptance criteria (definition of done)
- User can input ENS or address and see NFTs for:
  - Ethereum mainnet
  - Base
  - Celo
- Cards appear as a 3D deck with:
  - visible stack
  - flip front/back
  - next/prev
  - shuffle
- Robust media handling (IPFS + missing image fallback).
- Clean error/loading/empty states.
- Compliant with `AGENTS.md`, `looking-glass.md`, `agent-learning-protocol.md`.
- Lint/typecheck/build pass.

---

## Guardrails / avoid
- Do not require wallet connection or signatures.
- Do not leak API keys to client.
- Do not hardcode network RPC keys if avoidable.
- Avoid overengineering (no WebGL needed for v1).
- Don’t block on perfect metadata; degrade gracefully.

---

## Deliverables
- Working app route/page
- Server API route for NFTs
- UI deck experience with animations
- `.env.example` with `ALCHEMY_KEY` (and `RPC_URL` for ENS)
- Minimal docs update
