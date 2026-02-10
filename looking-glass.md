# Looking Glass

## What this document is
This is a kid-friendly map of what we built.
It explains what the app does (the parts you can see) and how the code makes that happen.

We keep explanations short, and we teach a few programming words along the way.

## Words we learned (tiny glossary)
Add new words as they appear.

- **Feature**: something the user can do in the app.
- **File**: a “page” where code is written.
- **Function**: a named “recipe” the computer can run.
- **State**: the app’s memory (what it currently knows).
- **API route**: a special URL in our app that runs code on the server and returns JSON data.
- **Query parameters**: the `?key=value` bits in a URL (they are inputs to an API route).
- **Normalize**: turn messy data into a clean, predictable shape the app can use.
- **3D transform**: a CSS trick that makes things look like they have depth (like a real card flipping).
- **Cache**: a short-term memory that avoids re-downloading the same data too often.
- **CSS variable**: a named color/number we store in CSS (like `--ink-black`) so many parts of the UI can share it.
- **Palette**: the small set of colors the app uses so it looks consistent.
- **Palette extraction**: looking at the pixels in an image to find the main colors.
- **Fallback**: a “backup choice” the app can try if the first choice fails.
- **Absolute positioning**: a CSS way to place something on top of other things without taking up normal layout space.
- **Index**: a number that points at a spot in a list (like “0 means the first thing”).
- **Grid**: a CSS way to divide a page into rows (and columns) so each part gets the right amount of space.
- **Thumbnail**: a tiny preview picture (a small version of the real image).
- **Ribbon**: a long, thin strip of UI that you can scroll sideways.

---

## The Feature Map (newest changes at the top)

### Feature: Thumbnail Ribbon (Pick Any NFT)
**What you can do (in the app):**  
Scroll a tiny row of NFT thumbnails at the bottom, and click any thumbnail to bring that NFT to the top of the deck.

**What the computer does (the story):**  
The deck has a list of cards (`order`) and a number called `activeIndex` that says which card is on top.

The ribbon shows thumbnails for all cards in `order`.
Scrolling the ribbon does not change `activeIndex`, so the top card stays the same.

When you click a thumbnail, the code runs `bringToTop(index)` in `src/components/NftDeckApp.tsx`.
That sets `activeIndex` to the clicked card and also turns off `isFlipped` (so you see the card front again).
Because the deck draws the “top N” cards starting at `activeIndex`, the clicked NFT becomes the new top card.

The ribbon tries to load the NFT image URL (and a few fallback URLs).
It prefers small thumbnail URLs first (Alchemy’s Cloudinary `thumbnailv2` when available), so the ribbon loads fast.
It tries direct URLs first (fast), and only then tries our `/api/media` proxy as a backup when a host blocks cross-site images or an IPFS gateway is flaky.
Thumbnails use `loading="lazy"` so we don’t download every image at once.

The ribbon also uses a **grid** trick to keep the thumbnails a good size.
It computes each thumbnail width so about 7 thumbnails fit across the ribbon at once.
Each thumbnail also has a minimum width so they stay readable (and the ribbon won’t collapse into thin “stripes”).

When you scroll the ribbon, it “snaps” so a thumbnail lands neatly in place.
If you have a mouse wheel, rolling the wheel while your pointer is over the ribbon scrolls the ribbon left/right.

If you focus a thumbnail (with Tab), the app won’t use ←/→ to flip the whole deck.
That’s because ribbon elements are marked with `data-no-global-keys`.

**Where this lives in the code:**  
- Ribbon UI: `src/components/DeckRibbon.tsx`
- “Bring to top” handler + keyboard guard: `src/components/NftDeckApp.tsx`

### Feature: Poster / Print View
**What you can do (in the app):**  
Open a “poster” page for the top NFT and print it as an art poster.

**What the computer does (the story):**  
When you click **Poster**, the app opens a new page at `/print`.
It passes a few **query parameters** (network, wallet, and which NFT id is on top).

On the poster page, the browser calls our own `/api/nfts` route again to get the NFT list, finds the matching card by `id`, and shows a clean “poster” layout with big media.

If the `id` is written in a weird way (for example “encoded” in the URL), the poster page also tries a backup match using the NFT’s **contract address** and **token id**.

If the NFT image link is flaky, the poster page uses the same media **fallback** list (and the `/api/media` proxy) to try multiple URLs.

When the image loads, the poster page does **palette extraction** (it samples pixels from the NFT image).
Then it uses those colors to re-color the “highlight” shapes (the big circle and rectangles) so each NFT can have its own poster vibe.

The poster sizes the “image window” to match the NFT image shape.
That way the whole image fits inside the window with no empty padding bars.
The image is placed toward the top of its picture area so it feels like the art starts higher on the page.

To make the NFT media feel like the main “art”, the poster page uses a **grid** layout.
The middle row (the media row) is guaranteed to be more than 60% of the poster height, so the image dominates the page.

The poster layout is inspired by classic Bauhaus exhibition posters.
At the top, you see a small “blurb” on the left, and a big token number on the right.
The NFT image area is kept clean (no extra background art) so the NFT stays the focus.

The small info boxes at the bottom (Owner / Token / Contract / Artist) are made smaller and pushed inward from the poster border.
This keeps the “text stuff” readable but secondary, and it gives the image even more room.

We can tune this balance: making the bottom text smaller gives even more space to the NFT image.
We can also tune how close the bottom boxes sit to the poster edge by adjusting padding in the poster layout.
The poster uses a bigger top padding than bottom padding, so it feels like the art is “hanging” on the page instead of sitting on the edge.
We also keep a little empty space above and below the NFT image so the header and footer don’t crowd the artwork.

When you click **Print**, the browser opens the print dialog. We add special **print CSS** so the Bauhaus colors and shapes keep their look on paper.
The print CSS also sizes the page for **A4** so the poster layout fits a standard print size.

The poster also shows full addresses (not shortened).
If the NFT metadata includes an **artist** name, it prints that.
If it does not, you can type an artist name into a text box and that typed name will be used on the printout.

**Where this lives in the code:**  
- Poster route: `src/app/print/page.tsx`
- Poster UI: `src/components/PrintPoster.tsx`
- Print CSS helpers: `src/app/globals.css`

### Feature: Smooth Next/Prev + Flip Animations
**What you can do (in the app):**  
When you press **Next** or **Prev**, the top card now moves fully off the deck, then slides behind the stack.  
When you press **Flip**, the card rotates smoothly to show the back.

**What the computer does (the story):**  
The deck has a “current card” number called `activeIndex` (an **index** is just a number that points to one item in a list).

When you press **Next** or **Prev**, we do the movement in two tiny steps:
1) **Out**: the top card moves fully off the stack (so it feels like you “picked it up”).
2) **Behind**: it goes behind the deck (so it feels like you’re putting it under).
3) **Settle**: it slides into its new place in the stack.

One tricky thing: when a card moves from “top” to “back”, the deck normally draws it in a new spot.
So we cancel out those stack offsets during the animation so the card doesn’t “teleport”.

Flip is its own animation: the card turns around the Y axis (like a real trading card).

If your device asks for less motion (the **prefers-reduced-motion** setting), we skip the fancy movement and just switch instantly.

**Where this lives in the code:**  
- Deck “current card” + cycle timing: `src/components/NftDeckApp.tsx`
- Per-card lift/drop transforms: `src/components/TradingCardDeck.tsx`
- Flip animation timing: `src/components/TradingCard.tsx`

**New word(s) in this feature:**  
- **Index**: a number that points at a spot in a list (like “card #0” means “the first card”).

### Feature: Cards Appear Inside The Art Frame
**What you can do (in the app):**  
Actually see the trading card deck inside the big left “art frame”.

**What the computer does (the story):**  
The deck is drawn as a stack of layers (many cards on top of each other).
Those layers are placed using **absolute positioning**, which means they “float” on top and do not push the layout to be taller.

So the deck also needs a parent box with a real height and width.
If the parent box accidentally has height `0`, the deck can look blank even though the HTML is there.

To prevent that, the deck wrapper always stretches to fill its parent.
That gives the floating layers real space to paint in the frame.

We also size the frame using the screen height so the card display can be bigger without getting clipped.

**Where this lives in the code:**  
- Frame layout: `src/components/NftDeckApp.tsx` (the fixed 3:4 art frame)
- Deck sizing fix: `src/components/TradingCardDeck.tsx` (wrapper uses `h-full w-full`)

**New word(s) in this feature:**  
- **Absolute positioning**: a CSS way to place something on top of other things without taking up normal layout space.

### Feature: Media Fallbacks (Images Load More Often)
**What you can do (in the app):**  
See NFT images more reliably, even when the first image link for a token fails to load.

**What the computer does (the story):**  
NFTs sometimes come with more than one possible media link (for example: a cached image, a thumbnail, or an IPFS link in the metadata).

On the server, we **normalize** the NFT into a “card” and keep a short ordered list of media URLs.
The first one becomes `imageUrl` (or `animationUrl`), and the rest become **fallbacks**.

If the NFT uses **IPFS**, we also generate a few different “gateway” URLs for the same file.
That way, if one IPFS gateway is down or slow, the next gateway can still work.

In the browser, the card tries the first URL.
If the browser says “this image failed”, the card automatically tries the next fallback URL.
It only shows “No media” after every candidate fails.

Because the deck uses a **3D transform**, we avoid “lazy loading” for the visible cards.
That means the top-of-deck images start downloading right away instead of sometimes staying blank.

If a browser extension blocks cross-site media (for example “blocked by client”), the card can also try a same-origin proxy.
That proxy lives inside our app, so the browser is just loading from `localhost`.

We try direct URLs first (fast), and only use the proxy if we need it.
The proxy has guardrails: it only allows `https://` URLs, blocks private-network hostnames, times out slow requests, and refuses very large files.

While an image is downloading, we show a soft “shimmer” placeholder so the card doesn’t look empty.

**Where this lives in the code:**  
- Server normalization: `src/lib/normalize.ts` (builds `imageUrl`, `imageFallbackUrls`, `animationUrl`, `animationFallbackUrls`)
- Card UI retry logic: `src/components/TradingCard.tsx` (uses `onError` to advance to the next fallback URL)
- Media proxy API route: `src/app/api/media/route.ts` (fetches an image/video on the server and returns it to the browser)

**New word(s) in this feature:**  
- **Fallback**: a backup choice.

### Feature: Bauhaus Sunset Visual Theme
**What you can do (in the app):**  
See the app in a bold “Bauhaus” style (thick black lines, cream background, stripes), and toggle a view mode that focuses on the deck.

**What the computer does (the story):**  
The colors are defined once using **CSS variables** (for example `--bg-cream` and `--ink-black`). That makes it easy to keep the whole app on the same **palette**.

The big frame, the circle/rectangle decorations, and the stripe bars are just normal `<div>` boxes with CSS styles. They do not change the NFT data; they only change how the page looks.

When you click **Toggle view mode**, the code flips a small piece of **state** called `artMode`. When `artMode` is on, the deck area scales up a little and the data panel fades down, so your eyes focus on the “art”.

**Where this lives in the code:**  
- UI piece(s): `src/components/NftDeckApp.tsx` (layout + decorations + toggle)
- Styling: `src/app/globals.css` (palette + stripes helpers), `src/app/layout.tsx` (fonts)

**New word(s) in this feature:**  
- **CSS variable**: a named style value we can reuse everywhere.

---

### Feature: Search A Wallet For NFTs
**What you can do (in the app):**  
Type a wallet address (or ENS name like `vitalik.eth`), pick a network, and load the NFT deck.

**What the computer does (the story):**  
When you press **Load NFTs**, the app reads what you typed and sends it to an **API route**. The API route runs on the server, so secret keys stay hidden.

If you typed an ENS name, the server uses an Ethereum mainnet **RPC URL** (a special server address) to turn the name into a real `0x…` address.

Then the server asks **Alchemy’s NFT API** for your NFTs, **normalizes** the response into a clean list of “cards”, and sends those cards back to the browser.

**Where this lives in the code:**  
- UI piece(s): `src/components/NftDeckApp.tsx`, `src/components/WalletSearchBar.tsx`, `src/components/NetworkToggle.tsx`
- Event handler(s): `src/components/NftDeckApp.tsx#submit`, `src/components/NftDeckApp.tsx#onChangeChain`
- Data/API: `src/app/api/nfts/route.ts`, `src/lib/ens.ts`, `src/lib/alchemy.ts`, `src/lib/normalize.ts`

**New word(s) in this feature:**  
- **Query parameters**: the inputs we put in the URL when we call `/api/nfts?...`.

---

### Feature: 3D Trading Card Deck
**What you can do (in the app):**  
Flip the top card to see the front and back, move to the next/previous card, and shuffle the deck.

**What the computer does (the story):**  
The deck keeps **state**: a list of cards in an order (top card first) and whether the top card is flipped.

When you click **Next**, the top card moves to the bottom of the list. When you click **Shuffle**, the list is mixed up. This changes what card is on top.

The “3D” look is made with a **3D transform**: the deck container has “perspective”, each card is offset a little, and the top card rotates around the Y axis to flip.

**Where this lives in the code:**  
- UI piece(s): `src/components/TradingCardDeck.tsx`, `src/components/TradingCard.tsx`, `src/components/DeckControls.tsx`
- Event handler(s): `src/components/NftDeckApp.tsx#next`, `src/components/NftDeckApp.tsx#prev`, `src/components/NftDeckApp.tsx#flip`, `src/components/NftDeckApp.tsx#shuffle`
- Tests (if any): `src/lib/ipfs.test.ts` (media URL helpers that make images/videos load more often)

**New word(s) in this feature:**  
- **3D transform**: CSS that makes the card look like it flips in real space.

---

### Feature: Keyboard Controls
**What you can do (in the app):**  
Use your keyboard: `←`/`→` for next/prev, Space/Enter to flip, and `S` to shuffle.

**What the computer does (the story):**  
The app listens for key presses. If you are not typing inside an input box, it treats those keys like button presses and runs the same functions as the on-screen controls.

**Where this lives in the code:**  
- Event handler(s): `src/components/NftDeckApp.tsx` (the `window.addEventListener("keydown", ...)` effect)

---

## How the app “wakes up” (high-level)
(Explain the startup flow in simple terms once the app exists.)
- The app starts at: `src/app/page.tsx`
- It shows the main screen by rendering: `src/components/NftDeckApp.tsx`
- The shared page wrapper (fonts + global styles) is in: `src/app/layout.tsx` and `src/app/globals.css`
