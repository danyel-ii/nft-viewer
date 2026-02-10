"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { isAddress } from "viem";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import type { ChainName } from "@/lib/chains";
import { CHAIN_LABEL, DEFAULT_CHAIN } from "@/lib/chains";
import type { NftApiResponse, NftCard } from "@/lib/types";
import { shuffled } from "@/lib/shuffle";

import { NetworkToggle } from "@/components/NetworkToggle";
import { WalletSearchBar } from "@/components/WalletSearchBar";
import { DeckControls } from "@/components/DeckControls";
import { TradingCardDeck } from "@/components/TradingCardDeck";

type Props = {
  initialChain?: ChainName;
  initialWallet?: string;
};

type LoadState = "idle" | "loading" | "ready" | "empty" | "error";

type CycleState =
  | {
      movingId: string;
      direction: "next" | "prev";
      phase: "out" | "behind" | "settle";
    }
  | null;

type DeckHandlers = {
  prev: () => void;
  next: () => void;
  flip: () => void;
  shuffle: () => void;
};

function buildQuery(args: { chain: ChainName; wallet: string; hideSpam: boolean }) {
  const p = new URLSearchParams();
  p.set("chain", args.chain);
  if (args.wallet) p.set("wallet", args.wallet);
  if (args.hideSpam === false) p.set("hideSpam", "false");
  return `/?${p.toString()}`;
}

function normalizeWalletInput(s: string) {
  return s.trim();
}

function looksLikeEns(s: string) {
  return s.toLowerCase().endsWith(".eth") && s.length > 4;
}

function shortHex(s: string) {
  if (!s) return "";
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function NftDeckApp(props: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;

  const [chain, setChain] = useState<ChainName>(props.initialChain ?? DEFAULT_CHAIN);
  const [walletInput, setWalletInput] = useState<string>(props.initialWallet ?? "");
  const [hideSpam, setHideSpam] = useState(true);
  const [artMode, setArtMode] = useState(false);

  const [state, setState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);

  const [order, setOrder] = useState<NftCard[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cycle, setCycle] = useState<CycleState>(null);

  const canInteract = order.length > 0 && state === "ready" && cycle === null;
  const visibleCount = 12;

  const activeCard =
    order.length > 0 ? (order[Math.min(activeIndex, order.length - 1)] ?? null) : null;
  const activeLabel =
    activeCard?.tokenName ||
    (activeCard ? `${activeCard.collectionName ?? "NFT"} #${activeCard.tokenId}` : null);

  const abortRef = useRef<AbortController | null>(null);
  const cycleTimersRef = useRef<number[]>([]);
  const handlersRef = useRef<DeckHandlers>({
    prev: () => {},
    next: () => {},
    flip: () => {},
    shuffle: () => {},
  });

  function clearCycleTimers() {
    for (const id of cycleTimersRef.current) window.clearTimeout(id);
    cycleTimersRef.current = [];
  }

  const cardById = useMemo(() => {
    const m = new Map<string, NftCard>();
    for (const c of order) m.set(c.id, c);
    return m;
  }, [order]);

  const deckCards = useMemo(() => {
    const n = Math.min(visibleCount, order.length);
    if (!n) return [];

    const at = (i: number) => order[(i + order.length) % order.length]!;
    const base: NftCard[] = [];
    for (let i = 0; i < n; i++) base.push(at(activeIndex + i));

    if (!cycle) return base;
    const moving = cardById.get(cycle.movingId);
    if (!moving) return base;

    // Keep the moving card mounted during the cycle.
    //
    // Next:
    // - During "out": moving card is already the top of `base`.
    // - During "behind"/"settle": `activeIndex` has advanced, so we append the old top
    //   card to the back to animate it sliding underneath.
    //
    // Prev:
    // - During "out": the incoming card is just behind the current top, so we append it
    //   to the back so it can animate out of the stack.
    const shouldAppendMoving =
      (cycle.direction === "next" && cycle.phase !== "out") ||
      (cycle.direction === "prev" && cycle.phase === "out");

    if (shouldAppendMoving) {
      const withoutMoving = base.filter((c) => c.id !== moving.id);
      const trimmed = withoutMoving.slice(0, Math.max(0, n - 1));
      return [...trimmed, moving];
    }

    return base;
  }, [activeIndex, cardById, cycle, order]);

  const statusLine = useMemo(() => {
    if (state === "loading") return "Loading NFTs…";
    if (state === "empty") return "No NFTs found on this network.";
    if (state === "error") return errorMessage ?? "Something went wrong.";
    return null;
  }, [state, errorMessage]);

  async function load(args: { chain: ChainName; wallet: string; hideSpam: boolean }) {
    const wallet = normalizeWalletInput(args.wallet);

    setState("loading");
    setErrorMessage(null);
    setWarnings([]);
    setTruncated(false);
    setResolvedAddress(null);
    setIsFlipped(false);
    setCycle(null);
    clearCycleTimers();

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const url = new URL("/api/nfts", window.location.origin);
      url.searchParams.set("chain", args.chain);
      url.searchParams.set("wallet", wallet);
      url.searchParams.set("hideSpam", args.hideSpam ? "true" : "false");

      const res = await fetch(url.toString(), { signal: ac.signal });
      const json = (await res.json()) as Partial<NftApiResponse> & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(json.error || `Request failed (${res.status}).`);
      }

      const cards = Array.isArray(json.cards) ? (json.cards as NftCard[]) : [];
      setResolvedAddress(typeof json.resolvedAddress === "string" ? json.resolvedAddress : null);
      setWarnings(Array.isArray(json.warnings) ? (json.warnings as string[]) : []);
      setTruncated(Boolean(json.truncated));

      if (cards.length === 0) {
        setOrder([]);
        setActiveIndex(0);
        setState("empty");
        return;
      }

      setOrder(cards);
      setActiveIndex(0);
      setState("ready");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Unexpected error.";
      setState("error");
      setErrorMessage(msg);
      setOrder([]);
      setActiveIndex(0);
    }
  }

  function submit() {
    const wallet = normalizeWalletInput(walletInput);
    if (!wallet) {
      setState("error");
      setErrorMessage("Enter an address or ENS name.");
      return;
    }

    // Client-side validation for faster feedback; server re-validates.
    if (!looksLikeEns(wallet) && !isAddress(wallet)) {
      setState("error");
      setErrorMessage("That does not look like a valid 0x… address or .eth name.");
      return;
    }

    router.replace(buildQuery({ chain, wallet, hideSpam }));
    void load({ chain, wallet, hideSpam });
  }

  function onChangeChain(next: ChainName) {
    setChain(next);
    const wallet = normalizeWalletInput(walletInput);
    router.replace(buildQuery({ chain: next, wallet, hideSpam }));
    if (wallet) void load({ chain: next, wallet, hideSpam });
  }

  function onToggleHideSpam(next: boolean) {
    setHideSpam(next);
    const wallet = normalizeWalletInput(walletInput);
    router.replace(buildQuery({ chain, wallet, hideSpam: next }));
    if (wallet) void load({ chain, wallet, hideSpam: next });
  }

  function next() {
    if (!canInteract || order.length < 2) return;
    setIsFlipped(false);
    const movingId = activeCard?.id;
    if (!movingId) return;

    if (reduceMotion) {
      setActiveIndex((i) => (i + 1) % order.length);
      return;
    }

    clearCycleTimers();
    setCycle({ movingId, direction: "next", phase: "out" });
    const outMs = 380;
    const behindMs = 420;
    const settleMs = 380;

    cycleTimersRef.current.push(
      window.setTimeout(() => {
        setCycle({ movingId, direction: "next", phase: "behind" });
        setActiveIndex((i) => (i + 1) % order.length);
      }, outMs),
    );
    cycleTimersRef.current.push(
      window.setTimeout(() => {
        setCycle({ movingId, direction: "next", phase: "settle" });
      }, outMs + behindMs),
    );
    cycleTimersRef.current.push(
      window.setTimeout(() => setCycle(null), outMs + behindMs + settleMs),
    );
  }

  function prev() {
    if (!canInteract || order.length < 2) return;
    setIsFlipped(false);
    const movingId = order[(activeIndex - 1 + order.length) % order.length]?.id;
    if (!movingId) return;

    if (reduceMotion) {
      setActiveIndex((i) => (i - 1 + order.length) % order.length);
      return;
    }

    clearCycleTimers();
    setCycle({ movingId, direction: "prev", phase: "out" });
    const outMs = 360;
    const settleMs = 420;
    cycleTimersRef.current.push(
      window.setTimeout(() => {
        setCycle({ movingId, direction: "prev", phase: "settle" });
        setActiveIndex((i) => (i - 1 + order.length) % order.length);
      }, outMs),
    );
    cycleTimersRef.current.push(
      window.setTimeout(() => setCycle(null), outMs + settleMs),
    );
  }

  function flip() {
    if (!canInteract) return;
    setIsFlipped((f) => !f);
  }

  function shuffle() {
    if (!canInteract || order.length < 2) return;
    setIsFlipped(false);
    setCycle(null);
    clearCycleTimers();
    setOrder((o) => shuffled(o));
    setActiveIndex(0);
  }

  function openPoster() {
    if (!canInteract) return;
    if (!activeCard) return;
    const wallet = normalizeWalletInput(walletInput);
    if (!wallet) return;

    const url = new URL("/print", window.location.origin);
    url.searchParams.set("chain", chain);
    url.searchParams.set("wallet", wallet);
    url.searchParams.set("hideSpam", hideSpam ? "true" : "false");
    url.searchParams.set("id", activeCard.id);

    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  // Keep the global keyboard handler wired to the latest callbacks without
  // re-attaching the event listener on every render.
  handlersRef.current = { prev, next, flip, shuffle };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" || tag === "textarea" || Boolean(target?.isContentEditable);
      if (isTyping) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlersRef.current.prev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handlersRef.current.next();
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handlersRef.current.flip();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handlersRef.current.shuffle();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    // Auto-load if URL provided an initial wallet.
    const wallet = normalizeWalletInput(walletInput);
    if (wallet) void load({ chain, wallet, hideSpam });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      clearCycleTimers();
    };
  }, []);

  const topTag = (activeCard?.collectionName || CHAIN_LABEL[chain]).toUpperCase();
  const topTitle = activeCard?.tokenName || "NFT\nDECK";
  const topDescription =
    activeCard?.description ||
    "Enter a wallet address or ENS name to load NFTs. Use Flip to see metadata on the card back.";

  const statCards =
    state === "loading" ? "…" : state === "ready" ? String(order.length) : "0";
  const statOwner =
    resolvedAddress ? shortHex(resolvedAddress) : walletInput ? walletInput : "—";
  const statToken = activeCard ? `#${activeCard.tokenId}` : "—";

  return (
    <div className="relative min-h-dvh px-4 py-8">
      {/* Background decorations (purely visual) */}
      <div className="pointer-events-none absolute -left-12 -top-12 h-[300px] w-[300px] rounded-full bg-[var(--bauhaus-blue)]" />
      <div className="pointer-events-none absolute bottom-[10%] right-[5%] h-[400px] w-[200px] bg-[var(--bauhaus-red)]" />
      <div className="pointer-events-none absolute left-[25%] top-0 hidden h-full w-1 bg-[var(--ink-black)] md:block" />
      <div className="pointer-events-none absolute right-0 top-[20%] hidden h-[300px] w-[120px] bauhaus-stripes border-l-4 border-[var(--ink-black)] md:block" />

      <div className="relative mx-auto w-[min(96vw,1600px)] min-h-[82dvh] bauhaus-frame grid grid-cols-1 overflow-hidden md:grid-cols-[1fr_420px]">
        {/* Art frame / deck */}
        <section className="relative flex items-center justify-center overflow-hidden border-b-4 border-[var(--ink-black)] p-4 md:border-b-0 md:border-r-4 md:p-8">
          <div
            className={clsx(
              // Use height as the driver so the deck can be larger without getting
              // clipped by the framed layout on shorter viewports.
              "relative h-[min(82dvh,940px)] w-auto max-w-[96%] max-h-full aspect-[3/4] transition-transform duration-500",
              artMode && "scale-[1.08]",
            )}
          >
            {/* Bauhaus composition blocks behind the deck */}
            <div className="pointer-events-none absolute -bottom-10 -left-14 h-24 w-[120%] bg-[var(--bauhaus-yellow)]" />
            <div className="pointer-events-none absolute top-10 -right-24 h-10 w-[80%] bg-[var(--bauhaus-blue)]" />
            <div className="pointer-events-none absolute -top-10 left-5 h-24 w-24 bg-[var(--bauhaus-red)]" />

            <div className="relative z-10 h-full w-full bg-white bauhaus-stroke">
              <TradingCardDeck
                cards={deckCards}
                visibleCount={visibleCount}
                isFlipped={isFlipped}
                onFlip={flip}
                isLoading={state === "loading"}
                activeLabel={activeLabel}
                className="h-full w-full"
                showLabel={false}
                cycle={cycle}
              />
            </div>
          </div>
        </section>

        {/* Data panel */}
        <section className="relative flex flex-col justify-between bg-[var(--bg-cream)] p-6 md:p-10">
          <div className="pointer-events-none absolute right-0 top-[40%] h-[300px] w-[150px] translate-x-1/2 rounded-l-[300px] bg-[var(--bauhaus-yellow)] opacity-80" />

          <div className={clsx("relative z-10", artMode && "opacity-40")}>
            <span
              className="inline-block bg-[var(--ink-black)] px-2 py-1 text-sm text-[var(--bg-cream)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {topTag}
            </span>

            <h1 className="mt-5 whitespace-pre-line font-[var(--font-display)] text-5xl leading-[0.82] tracking-[-0.06em] text-[var(--ink-black)]">
              {topTitle}
            </h1>

            <p
              className="mt-4 text-sm leading-6 text-[color:rgba(45,26,18,0.80)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {topDescription}
            </p>

            <div className="my-6 h-[60px] w-full bauhaus-stripes border-y-4 border-[var(--ink-black)]" />

            <div className="grid grid-cols-2 gap-0 bauhaus-stroke">
              <div className="p-4 border-b-4 border-r-4 border-[var(--ink-black)]">
                <span
                  className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Cards
                </span>
                <div className="mt-1 text-2xl font-black text-[var(--ink-black)]">
                  {statCards}
                  {truncated ? "*" : ""}
                </div>
              </div>
              <div className="p-4 border-b-4 border-[var(--ink-black)]">
                <span
                  className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Network
                </span>
                <div className="mt-1 text-2xl font-black text-[var(--ink-black)]">
                  {CHAIN_LABEL[chain]}
                </div>
              </div>
              <div className="p-4 border-r-4 border-[var(--ink-black)]">
                <span
                  className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Owner
                </span>
                <div className="mt-1 text-xl font-black text-[var(--ink-black)] break-all">
                  {statOwner}
                </div>
              </div>
              <div className="p-4">
                <span
                  className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Token
                </span>
                <div className="mt-1 text-2xl font-black text-[var(--ink-black)]">
                  {statToken}
                </div>
              </div>
            </div>

            {truncated ? (
              <p className="mt-2 text-[11px] text-[color:rgba(45,26,18,0.75)]">
                * Results may be truncated for very large wallets.
              </p>
            ) : null}
          </div>

          <div className="relative z-10 mt-6 flex flex-col gap-4">
            <button
              type="button"
              role="switch"
              aria-checked={artMode}
              onClick={() => setArtMode((v) => !v)}
              className="flex items-center justify-between gap-4 p-3 bauhaus-stroke bg-[var(--bg-cream)] transition-colors hover:bg-[color:rgba(226,88,62,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-black)]">
                Toggle view mode
              </span>
              <span className="relative h-8 w-16 bg-[var(--ink-black)]">
                <span
                  className={clsx(
                    "absolute left-1 top-1 h-6 w-6 bg-[var(--bauhaus-yellow)] transition-transform duration-300",
                    artMode && "translate-x-8 bg-[var(--bauhaus-red)]",
                  )}
                />
              </span>
            </button>

            <WalletSearchBar
              value={walletInput}
              onChange={setWalletInput}
              onSubmit={submit}
              isLoading={state === "loading"}
            />

            <div className="flex flex-col gap-3">
              <NetworkToggle chain={chain} onChange={onChangeChain} />

              <button
                type="button"
                role="switch"
                aria-checked={hideSpam}
                onClick={() => onToggleHideSpam(!hideSpam)}
                className="flex items-center justify-between gap-4 p-3 bauhaus-stroke bg-[var(--bg-cream)] transition-colors hover:bg-[color:rgba(226,88,62,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-black)]">
                  Hide spam
                </span>
                <span className="relative h-8 w-16 bg-[var(--ink-black)]">
                  <span
                    className={clsx(
                      "absolute left-1 top-1 h-6 w-6 bg-[var(--bauhaus-yellow)] transition-transform duration-300",
                      hideSpam ? "translate-x-0" : "translate-x-8 bg-[var(--bauhaus-red)]",
                    )}
                  />
                </span>
              </button>
            </div>

            <DeckControls
              disabled={!canInteract}
              onPrev={prev}
              onNext={next}
              onFlip={flip}
              onShuffle={shuffle}
              onPoster={openPoster}
            />

            {warnings.length ? (
              <div className="bauhaus-stroke bg-white p-3 text-[11px] leading-5 text-[color:rgba(45,26,18,0.80)]">
                <span className="font-semibold">Note:</span> {warnings.join(" ")}
              </div>
            ) : null}

            {statusLine ? (
              <div
                className={clsx(
                  "bauhaus-stroke p-3 text-sm",
                  state === "error" ? "bg-[var(--bauhaus-red)] text-[var(--bg-cream)]" : "bg-white text-[var(--ink-black)]",
                )}
                role={state === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                {statusLine}
              </div>
            ) : null}

            <p className="text-[11px] leading-5 text-[color:rgba(45,26,18,0.75)]">
              Keyboard: ←/→ next/prev, Space or Enter flip, S shuffle.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
