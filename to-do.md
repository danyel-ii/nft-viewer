# to-do.md

## 0) Mandatory protocol compliance
- [ ] Read `AGENTS.md` and follow it throughout
- [ ] Read `looking-glass.md` and apply required reflection/logging
- [ ] Read `agent-learning-protocol.md` and apply required learning/notes workflow

## 1) Repo discovery & setup
- [ ] Identify package manager (pnpm/yarn/npm) and use it consistently
- [ ] Identify existing web framework / app location (root vs `apps/*`)
- [ ] Confirm lint/typecheck/test commands and CI expectations
- [ ] Confirm styling system (Tailwind, CSS modules, styled-components, etc.)

## 2) Project scaffolding / integration
- [ ] Create or integrate a web route/page for the NFT Deck viewer
- [ ] Ensure navigation/access to the page (link from home or direct route)
- [ ] Add minimal layout shell (header, input, deck area)

## 3) Environment configuration
- [ ] Add `.env.example` with:
  - [ ] `ALCHEMY_KEY=`
  - [ ] `RPC_URL=`
- [ ] Ensure `.env.local` is gitignored (follow repo conventions)

## 4) NFT fetch API (server-side)
- [ ] Implement `GET /api/nfts`
  - [ ] Inputs: `chain`, `wallet` (address or ENS), optional `hideSpam`
  - [ ] Validate chain is one of:
    - [ ] `eth-mainnet`
    - [ ] `base-mainnet`
    - [ ] `celo-mainnet`
  - [ ] ENS resolution strategy:
    - [ ] If `.eth`, resolve to `0x...` (server-side preferred)
    - [ ] If invalid / not found, return a clear 400 error
  - [ ] Call Alchemy NFT API `getNFTsForOwner` endpoint
  - [ ] Flatten response into `cards[]` (one entry per token held)
  - [ ] Normalize media URLs:
    - [ ] `ipfs://` → HTTPS gateway
    - [ ] handle missing/invalid URLs
  - [ ] Return JSON:
    - [ ] `chain`, `walletInput`, `resolvedAddress`, `count`, `cards[]`
- [ ] Add basic caching (TTL) per `(chain,resolvedAddress)`

## 5) Client data flow
- [ ] Wallet input component with validation
- [ ] Network toggle (Ethereum / Base / Celo)
- [ ] Fetch on submit + on network change
- [ ] Sync wallet + chain to URL query params
- [ ] Loading / error / empty states

## 6) Deck state + controls
- [ ] Maintain deck state:
  - [ ] `cards`
  - [ ] `order` (array of indices or cards)
  - [ ] `activeIndex`
  - [ ] `isFlipped`
- [ ] Controls:
  - [ ] Next
  - [ ] Previous
  - [ ] Flip (front/back)
  - [ ] Shuffle (randomize order with animation)
- [ ] Keyboard support:
  - [ ] ←/→ next/prev
  - [ ] space/enter flip
  - [ ] “S” shuffle

## 7) 3D Trading Card UI
- [ ] Implement 3D deck container with `perspective`
- [ ] Render top N stack cards with depth offsets
- [ ] Card flip:
  - [ ] `preserve-3d`, `backface-visibility`
  - [ ] smooth animated rotateY
- [ ] Front face:
  - [ ] image render
  - [ ] optional video render if `animation_url` present and compatible
  - [ ] fallback placeholder
- [ ] Back face:
  - [ ] title + collection
  - [ ] contract + token id (copy button)
  - [ ] traits grid/pills
  - [ ] description (clamp)
  - [ ] link(s) if available

## 8) Motion & responsiveness
- [ ] Use repo’s animation approach (Framer Motion if allowed)
- [ ] Shuffle animation feels “deck-like”
- [ ] Mobile-friendly layout + touch support (tap to flip, optional swipe)
- [ ] Respect `prefers-reduced-motion`

## 9) Quality & hardening
- [ ] Handle large wallets (don’t render hundreds of DOM nodes)
- [ ] Avoid layout shifts (reserve space, skeletons)
- [ ] No console errors
- [ ] Lint/typecheck/build pass
- [ ] Add minimal tests if repo requires them (at least for normalization helpers)

## 10) Documentation
- [ ] Update README/docs with:
  - [ ] how to run
  - [ ] env vars
  - [ ] supported networks
  - [ ] known limitations (e.g., some NFTs have missing media)

## 11) Final verification checklist
- [ ] ENS input works (e.g., `vitalik.eth`)
- [ ] Address input works (`0x...`)
- [ ] Toggle networks shows different holdings when applicable
- [ ] Deck: flip + next/prev + shuffle all work
- [ ] Error handling is user-friendly
- [ ] Protocol compliance notes recorded per repo rules
