# NFT Trading Card Deck

Read-only web app that lets you enter an **EVM address or ENS name** and browse all NFTs held by that public wallet as a **3D trading-card deck**.

## Features
- Wallet input: `0x…` address or ENS (example: `vitalik.eth`)
- Network toggle: **Ethereum mainnet**, **Base**, **Celo**
- 3D deck controls: **Prev / Next / Flip / Shuffle**
- Poster view: **Poster** button opens `/print` for the current top card (print-friendly art poster)
  - Print poster is A4-sized and automatically themes its accent colors from the NFT image
- Keyboard controls:
  - `←` / `→`: previous / next
  - `Space` or `Enter`: flip
  - `S`: shuffle
- Accessibility: visible focus styles, respects `prefers-reduced-motion`
- Robust loading / empty / error states

## Tech
- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- Server-side data fetching via Alchemy NFT API (API key never sent to the browser)

## Local Development

### 1) Install
```bash
pnpm install
```

### 2) Configure env vars
Create `.env.local` based on `.env.example`:

- `ALCHEMY_KEY` (required): Alchemy API key (used for NFT API)
- `RPC_URL` (optional, recommended): Ethereum mainnet RPC URL used for ENS resolution (so `vitalik.eth` works). If omitted, the server will fall back to using `ALCHEMY_KEY` to build a mainnet RPC URL.

### 3) Run
```bash
pnpm dev
```
Open `http://localhost:3000`.

## Supported Networks
Alchemy `chain` values used by the app:
- `eth-mainnet`
- `base-mainnet`
- `celo-mainnet`

## API
Server route:
- `GET /api/nfts?chain=<chainName>&wallet=<0x-or-ens>&hideSpam=true|false`

Response shape:
- `chain`, `walletInput`, `resolvedAddress`, `count`, `cards[]`
  - Each card includes `artist` when available from metadata (otherwise `null`)

## Known Limitations
- Some NFTs have missing/broken metadata or media URLs; the UI falls back gracefully.
- Very large wallets may be **truncated** if the upstream provider requires pagination beyond the server safety limit.
- Spam filtering may require a paid Alchemy plan; the server will fall back to showing all NFTs if filtering is unavailable.
- Some networks may not be supported for Alchemy NFT indexing depending on product availability.
