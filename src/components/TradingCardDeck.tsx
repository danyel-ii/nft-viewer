"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";

import type { NftCard } from "@/lib/types";
import { TradingCard } from "@/components/TradingCard";

function hash01(input: string) {
  // FNV-1a-ish tiny hash for stable "random-ish" visuals.
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

function SkeletonCard(props: { index: number }) {
  const tilt = (props.index % 2 === 0 ? 1 : -1) * (0.8 + props.index * 0.08);
  return (
    <div
      className="absolute inset-0 rounded-none bg-white bauhaus-stroke"
      style={{
        transform: `translate3d(${-props.index * 2}px, ${props.index * 7}px, ${-props.index * 12}px) rotateZ(${tilt}deg)`,
      }}
    >
      <div className="h-full w-full animate-pulse bg-[linear-gradient(135deg,rgba(45,26,18,0.10),rgba(45,26,18,0.06),rgba(45,26,18,0.10))]" />
    </div>
  );
}

export function TradingCardDeck(props: {
  cards: NftCard[];
  visibleCount: number;
  isFlipped: boolean;
  onFlip: () => void;
  isLoading: boolean;
  activeLabel: string | null;
  className?: string;
  showLabel?: boolean;
  cycle?: {
    movingId: string;
    direction: "next" | "prev";
    phase: "out" | "behind" | "settle";
  } | null;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const visible = props.cards.slice(0, Math.max(0, props.visibleCount));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const containerClass = clsx(
    "relative mx-auto",
    props.className ?? "h-[560px] w-[380px] max-w-full",
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const next = { w: Math.round(rect.width), h: Math.round(rect.height) };
      setContainerSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    };

    update();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className={containerClass}>
        <div className="absolute inset-0 [perspective:1200px]">
          <div className="relative h-full w-full [transform-style:preserve-3d] [transform:rotateX(9deg)_rotateY(-12deg)]">
            {props.isLoading ? (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} index={i} />
                ))}
              </>
            ) : visible.length ? (
              visible.map((card, i) => {
                const depth = i;
                const seed = hash01(card.id);

                const x = -depth * 2 + (seed - 0.5) * 2;
                const y = depth * 7 + (seed - 0.5) * 1.5;
                const z = -depth * 12;
                const rotateZ = (seed - 0.5) * 1.6 + depth * 0.12;
                const rotateX = (seed - 0.5) * 0.8;
                const scale = 1 - depth * 0.01;

                const isTop = depth === 0;

                const cycle = props.cycle;
                const isMoving = Boolean(cycle && cycle.movingId === card.id);
                const isOut = Boolean(isMoving && cycle?.phase === "out");
                const isBehind = Boolean(isMoving && cycle?.phase === "behind");
                const isSettle = Boolean(isMoving && cycle?.phase === "settle");

                const dir = cycle?.direction ?? "next";
                const sign = dir === "next" ? 1 : -1;
                const deckW = containerSize.w || 380;
                const deckH = containerSize.h || 560;

                // A 3-phase "take the top card off the stack, then slide it behind" motion.
                //
                // Important detail:
                // - During Next, the moving card changes from depth=0 (top) to depth=last (back).
                // - If we don't compensate for that, it will "teleport" when `activeIndex` changes.
                // - So, for the moving card, we define phase targets in *absolute* space and
                //   compute deltas that cancel the base stack offsets for the current `depth`.
                const outX = sign * Math.max(460, deckW * 1.1);
                const outY = -Math.round(Math.min(180, deckH * 0.22));
                const outZ = Math.round(Math.max(560, deckW * 1.2));

                const behindX = sign * Math.max(220, deckW * 0.32);
                const behindY = Math.round(Math.min(320, deckH * 0.42));
                const behindZ = -Math.round(Math.max(820, deckW * 1.7));

                const extraX = isOut
                  ? outX + depth * 2
                  : isBehind
                    ? behindX + depth * 2
                    : 0;
                const extraY = isOut
                  ? outY - depth * 7
                  : isBehind
                    ? behindY - depth * 7
                    : 0;
                const extraZ = isOut
                  ? outZ + depth * 12
                  : isBehind
                    ? behindZ + depth * 12
                    : 0;

                const extraRotateZ = isOut
                  ? sign * 22 - depth * 0.12
                  : isBehind
                    ? -sign * 8 - depth * 0.12
                    : 0;
                const extraRotateX = isOut ? -4 : isBehind ? 2 : 0;

                // Keep the moving card roughly the same *absolute* scale while it animates out/behind.
                const extraScale = isOut
                  ? 0.06 + depth * 0.01
                  : isBehind
                    ? -0.03 + depth * 0.01
                    : 0;

                const transition = reduceMotion
                  ? { duration: 0 }
                  : isOut
                    ? { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }
                    : isBehind
                      ? { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const }
                      : isSettle
                        ? { type: "spring" as const, stiffness: 460, damping: 42 }
                        : { type: "spring" as const, stiffness: 380, damping: 38 };

                return (
                  <motion.div
                    key={card.id}
                    className={clsx(
                      "absolute inset-0",
                      !isTop ? "pointer-events-none" : "pointer-events-auto",
                    )}
                    style={{
                      // Only force "on top" while the moving card is leaving the deck.
                      // Once it's sliding behind the stack, let normal stack order take over.
                      zIndex: isOut ? 999 : visible.length - depth,
                      transformStyle: "preserve-3d",
                    }}
                    animate={{
                      x: x + extraX,
                      y: y + extraY,
                      z: z + extraZ,
                      rotateZ: rotateZ + extraRotateZ,
                      rotateX: rotateX + extraRotateX,
                      scale: scale + extraScale,
                    }}
                    transition={transition}
                    aria-hidden={!isTop}
                  >
                    <TradingCard
                      card={card}
                      isTop={isTop}
                      isFlipped={isTop ? props.isFlipped : false}
                      onFlip={isTop && !props.cycle ? props.onFlip : undefined}
                    />
                  </motion.div>
                );
              })
            ) : (
              <div className="absolute inset-0 flex items-center justify-center rounded-none bg-[var(--bg-cream)] text-center text-sm text-[var(--ink-black)] bauhaus-stroke">
                <div className="px-8">
                  <p className="font-[var(--font-display)] uppercase tracking-wide">
                    Your deck is empty
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:rgba(45,26,18,0.72)]">
                    Load a wallet to build a stack of NFT cards.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {props.showLabel !== false && props.activeLabel ? (
        <p
          className="mt-3 text-center text-[11px] uppercase tracking-wider text-[color:rgba(45,26,18,0.70)]"
          style={{ fontFamily: "var(--font-mono)" }}
          aria-live="polite"
        >
          Viewing:{" "}
          <span className="font-semibold text-[var(--ink-black)]">
            {props.activeLabel}
          </span>
        </p>
      ) : null}
    </div>
  );
}
