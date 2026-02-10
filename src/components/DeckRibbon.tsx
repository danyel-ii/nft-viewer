"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

import type { NftCard } from "@/lib/types";

function toMediaProxyUrl(url: string) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/api/media?")) return null;

  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return null;
    return `/api/media?url=${encodeURIComponent(trimmed)}`;
  } catch {
    return null;
  }
}

function scoreThumbUrl(url: string) {
  const u = url.toLowerCase();

  // Alchemy provides fast Cloudinary thumbnails; prefer those for the ribbon.
  if (u.includes("res.cloudinary.com/alchemyapi/image/upload/thumbnailv2/")) return 0;
  if (u.includes("thumbnailv2")) return 0;
  if (u.includes("thumbnail")) return 1;
  if (u.includes("thumb")) return 2;

  if (u.includes("convert-png")) return 3;

  // The nft-cdn URLs can be very large (e.g. full GIFs); keep them as last resort.
  if (u.includes("nft-cdn.alchemy.com")) return 9;

  return 5;
}

function buildThumbAttemptUrls(args: { imageUrl: string | null; imageFallbackUrls?: string[] }) {
  const raw = [args.imageUrl, ...(args.imageFallbackUrls ?? [])].filter(Boolean) as string[];

  const base: string[] = [];
  const seenBase = new Set<string>();
  for (const url of raw) {
    if (seenBase.has(url)) continue;
    seenBase.add(url);
    base.push(url);
  }

  base.sort((a, b) => scoreThumbUrl(a) - scoreThumbUrl(b));

  // Prefer direct URLs first (faster, avoids routing everything through our server),
  // then fall back to the same-origin proxy URL if needed.
  const attempts: string[] = [];
  const seenAttempt = new Set<string>();
  for (const url of base) {
    if (!seenAttempt.has(url)) {
      seenAttempt.add(url);
      attempts.push(url);
    }

    const proxied = toMediaProxyUrl(url);
    if (proxied && !seenAttempt.has(proxied)) {
      seenAttempt.add(proxied);
      attempts.push(proxied);
    }
  }

  return attempts;
}

function ribbonLabel(card: NftCard) {
  const title = card.tokenName || `#${card.tokenId}`;
  const coll = card.collectionName || card.contractAddress;
  return `${coll} ${title}`;
}

function RibbonThumb(props: {
  card: NftCard;
  isActive: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const imageUrl = props.card.imageUrl ?? null;
  const imageFallbackUrls = props.card.imageFallbackUrls;
  const attempts = useMemo(
    () => buildThumbAttemptUrls({ imageUrl, imageFallbackUrls }),
    [imageFallbackUrls, imageUrl],
  );
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const src = attempts[attemptIndex] ?? null;

  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onSelect}
      className={clsx(
        "relative h-14 w-full min-w-16 overflow-hidden rounded-none bg-white bauhaus-stroke",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        props.isActive && "outline outline-2 outline-[var(--bauhaus-red)] outline-offset-2",
      )}
      aria-label={`Bring to top: ${ribbonLabel(props.card)}`}
      aria-current={props.isActive ? "true" : undefined}
      data-no-global-keys
      style={{ contentVisibility: "auto", containIntrinsicSize: "56px 56px" }}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={props.card.tokenName || `NFT #${props.card.tokenId}`}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            const next = attemptIndex + 1;
            if (attempts[next]) {
              setAttemptIndex(next);
              return;
            }
            setFailed(true);
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[var(--bg-cream)]">
          <div className="h-6 w-6 bg-[var(--bauhaus-yellow)] bauhaus-stroke" aria-hidden />
        </div>
      )}

      <span
        className={clsx(
          "pointer-events-none absolute left-1.5 top-1.5 h-2 w-2 bauhaus-stroke",
          props.isActive ? "bg-[var(--bauhaus-red)]" : "bg-[var(--ink-black)]",
        )}
        aria-hidden
      />
    </button>
  );
}

export function DeckRibbon(props: {
  cards: NftCard[];
  activeIndex: number;
  disabled?: boolean;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const disabled = props.disabled ?? false;

  return (
    <div
      className={clsx(
        "bauhaus-stroke bg-[var(--bg-cream)] p-2",
        "shadow-[10px_10px_0_var(--shadow-color)]",
        props.className,
      )}
      data-no-global-keys
      aria-label="NFT thumbnail ribbon"
    >
      <div className="grid grid-flow-col auto-cols-[minmax(0,calc((100%_-_3rem)_/_7))] gap-2 overflow-x-auto overscroll-x-contain scroll-smooth">
        {props.cards.map((card, index) => (
          <RibbonThumb
            key={card.id}
            card={card}
            isActive={index === props.activeIndex}
            disabled={disabled}
            onSelect={() => props.onSelect(index)}
          />
        ))}
      </div>
    </div>
  );
}
