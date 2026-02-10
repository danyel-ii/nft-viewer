"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";

import type { NftCard } from "@/lib/types";
import { CopyButton } from "@/components/CopyButton";

function shortHex(s: string) {
  if (!s) return "";
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function clampText(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

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

function isVideoCandidateUrl(url: string) {
  const u = url.trim().toLowerCase();
  if (!u) return false;

  // Avoid trying to play interactive HTML (common in generative NFTs) as a video.
  if (u.startsWith("data:")) return u.startsWith("data:video/");

  const path = u.split(/[?#]/, 1)[0] ?? u;
  if (
    path.endsWith(".html") ||
    path.endsWith(".htm") ||
    path.endsWith(".json") ||
    path.endsWith(".glb") ||
    path.endsWith(".gltf")
  ) {
    return false;
  }

  // If it clearly looks like an image, don't treat it as a video candidate.
  if (
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".gif") ||
    path.endsWith(".webp") ||
    path.endsWith(".avif") ||
    path.endsWith(".svg")
  ) {
    return false;
  }

  return true;
}

export function TradingCard(props: {
  card: NftCard;
  isTop: boolean;
  isFlipped: boolean;
  onFlip?: () => void;
}) {
  const reduceMotion = useReducedMotion() ?? false;

  const [imgIndex, setImgIndex] = useState(0);
  const [videoIndex, setVideoIndex] = useState(0);
  const [imgLoadedUrl, setImgLoadedUrl] = useState<string | null>(null);

  const title = props.card.tokenName || `#${props.card.tokenId}`;
  const subtitle = props.card.collectionName || shortHex(props.card.contractAddress);

  const imageAttemptUrls = useMemo(() => {
    const raw = [
      props.card.imageUrl,
      ...(props.card.imageFallbackUrls ?? []),
    ].filter(Boolean) as string[];

    const base: string[] = [];
    const seenBase = new Set<string>();
    for (const url of raw) {
      if (seenBase.has(url)) continue;
      seenBase.add(url);
      base.push(url);
    }

    // Prefer a same-origin proxy URL first (more reliable with extensions/shields),
    // then fall back to the direct URL.
    const attempts: string[] = [];
    const seenAttempt = new Set<string>();
    for (const url of base) {
      const proxied = toMediaProxyUrl(url);
      if (proxied && !seenAttempt.has(proxied)) {
        seenAttempt.add(proxied);
        attempts.push(proxied);
      }

      if (!seenAttempt.has(url)) {
        seenAttempt.add(url);
        attempts.push(url);
      }
    }

    return attempts;
  }, [props.card.imageFallbackUrls, props.card.imageUrl]);

  const videoCandidates = useMemo(() => {
    const raw = [
      props.card.animationUrl,
      ...(props.card.animationFallbackUrls ?? []),
    ].filter(Boolean) as string[];

    const out: string[] = [];
    const seen = new Set<string>();
    for (const url of raw) {
      if (!isVideoCandidateUrl(url)) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
    return out;
  }, [props.card.animationFallbackUrls, props.card.animationUrl]);

  const { mediaKind, mediaUrl } = useMemo(() => {
    const img = imageAttemptUrls[imgIndex] ?? null;
    if (img) {
      return { mediaKind: "image" as const, mediaUrl: img };
    }

    const video = videoCandidates[videoIndex] ?? null;
    if (video) {
      return { mediaKind: "video" as const, mediaUrl: video };
    }

    return { mediaKind: "none" as const, mediaUrl: null };
  }, [imageAttemptUrls, imgIndex, videoCandidates, videoIndex]);

  const imgLoaded = mediaKind === "image" && Boolean(mediaUrl) && imgLoadedUrl === mediaUrl;

  const imgRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (!node) return;
      if (mediaKind !== "image" || !mediaUrl) return;

      // Some browsers won't fire `onLoad` for cached images. If the element is already
      // complete, treat it as loaded so we don't keep the shimmer overlay on top.
      if (node.complete && node.naturalWidth > 0) {
        setImgLoadedUrl((prev) => (prev === mediaUrl ? prev : mediaUrl));
      }
    },
    [mediaKind, mediaUrl],
  );

  useEffect(() => {
    if (mediaKind !== "image" || !mediaUrl || imgLoaded) return;

    const id = window.setTimeout(() => {
      setImgIndex((i) => Math.min(i + 1, imageAttemptUrls.length));
    }, 4000);

    return () => window.clearTimeout(id);
  }, [imageAttemptUrls.length, imgLoaded, mediaKind, mediaUrl]);

  const rotateY = props.isTop && props.isFlipped ? 180 : 0;

  const interactive = props.isTop && Boolean(props.onFlip);

  return (
    <div
      onClick={(e) => {
        if (!interactive || !props.onFlip) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest("a,button,input,textarea,select,[data-no-flip]")) return;
        props.onFlip();
      }}
      onKeyDown={(e) => {
        if (!interactive || !props.onFlip) return;
        if (e.key !== " " && e.key !== "Enter") return;
        const target = e.target as HTMLElement | null;
        if (target?.closest("a,button,input,textarea,select,[data-no-flip]")) return;
        e.preventDefault();
        e.stopPropagation(); // don't also trigger the global key handler
        props.onFlip();
      }}
      className={clsx(
        "group relative h-full w-full select-none rounded-none text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]",
        interactive ? "cursor-pointer" : "cursor-default",
      )}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? "Flip card" : undefined}
      aria-pressed={interactive ? props.isFlipped : undefined}
    >
      <motion.div
        className="relative h-full w-full rounded-none [transform-style:preserve-3d]"
        animate={{ rotateY }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
        }
      >
        {/* Front */}
        <div className="absolute inset-0 overflow-hidden rounded-none bg-white bauhaus-stroke shadow-[10px_10px_0_var(--shadow-color)] [backface-visibility:hidden]">
          <div className="relative flex h-full flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <span
                className="inline-block max-w-[70%] truncate px-2 py-1 text-[11px] font-semibold uppercase tracking-wider bg-[var(--ink-black)] text-[var(--bg-cream)]"
                style={{ fontFamily: "var(--font-mono)" }}
                title={subtitle}
              >
                {subtitle}
              </span>
              <span
                className="inline-block px-2 py-1 text-[11px] font-semibold uppercase tracking-wider bg-[var(--bg-cream)] text-[var(--ink-black)] bauhaus-stroke"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                #{props.card.tokenId}
              </span>
            </div>

            <h3 className="font-[var(--font-display)] text-2xl leading-[0.95] tracking-tight text-[var(--ink-black)]">
              {title}
            </h3>

            <div className="relative isolate flex-1 overflow-hidden bg-white bauhaus-stroke">
              {mediaKind === "image" && mediaUrl ? (
                <>
                  {!imgLoaded ? (
                    <div className="pointer-events-none absolute inset-0 z-0 animate-pulse bg-[linear-gradient(135deg,rgba(45,26,18,0.12),rgba(45,26,18,0.06),rgba(45,26,18,0.12))]" />
                  ) : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={mediaUrl}
                    src={mediaUrl}
                    alt={title}
                    ref={imgRef}
                    className="relative z-10 h-full w-full object-cover [transform:translateZ(0)]"
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onLoad={() => setImgLoadedUrl(mediaUrl)}
                    onError={() => {
                      setImgLoadedUrl(null);
                      setImgIndex((i) => Math.min(i + 1, imageAttemptUrls.length));
                    }}
                  />
                </>
              ) : null}

              {mediaKind === "video" && mediaUrl ? (
                <video
                  className="h-full w-full object-cover"
                  src={mediaUrl}
                  playsInline
                  muted
                  loop
                  preload={props.isTop ? "auto" : "metadata"}
                  autoPlay={!reduceMotion && props.isTop}
                  controls={reduceMotion && props.isTop}
                  onError={() =>
                    setVideoIndex((i) => Math.min(i + 1, videoCandidates.length))
                  }
                />
              ) : null}

              {mediaKind === "none" ? (
                <div className="flex h-full w-full items-center justify-center bg-[var(--bg-cream)]">
                  <div className="flex flex-col items-center gap-2 px-6 text-center">
                    <div className="h-10 w-10 bg-[var(--bauhaus-yellow)] bauhaus-stroke" />
                    <p className="text-sm font-[var(--font-display)] uppercase tracking-wide text-[var(--ink-black)]">
                      No media
                    </p>
                    <p className="text-xs leading-5 text-[color:rgba(45,26,18,0.72)]">
                      This NFT did not include a usable image or video URL.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div
              className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wider text-[color:rgba(45,26,18,0.75)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span className="truncate">Contract {shortHex(props.card.contractAddress)}</span>
              {interactive ? (
                <span className="shrink-0 bg-[var(--ink-black)] px-2 py-1 font-semibold text-[var(--bg-cream)]">
                  Flip
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 overflow-hidden rounded-none bg-[var(--bg-cream)] text-[var(--ink-black)] bauhaus-stroke shadow-[10px_10px_0_var(--shadow-color)] [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <div className="h-10 w-full bauhaus-stripes bauhaus-stroke-b" />
          <div className="relative flex h-[calc(100%-40px)] flex-col gap-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <span
                className="inline-block max-w-[70%] truncate px-2 py-1 text-[11px] font-semibold uppercase tracking-wider bg-[var(--ink-black)] text-[var(--bg-cream)]"
                style={{ fontFamily: "var(--font-mono)" }}
                title={subtitle}
              >
                {subtitle}
              </span>
              <span
                className="inline-block bg-[var(--bauhaus-yellow)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-black)] bauhaus-stroke"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Back
              </span>
            </div>

            <div className="grid grid-cols-2 gap-0 bauhaus-stroke">
              <div className="p-3 bauhaus-stroke-r bauhaus-stroke-b">
                <span
                  className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Contract
                </span>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code
                    className="truncate bg-white px-2 py-1 text-[11px] text-[var(--ink-black)] bauhaus-stroke"
                    style={{ fontFamily: "var(--font-mono)" }}
                    title={props.card.contractAddress}
                  >
                    {shortHex(props.card.contractAddress)}
                  </code>
                  <CopyButton text={props.card.contractAddress} label="contract address" />
                </div>
              </div>
              <div className="p-3 bauhaus-stroke-b">
                <span
                  className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Token ID
                </span>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code
                    className="truncate bg-white px-2 py-1 text-[11px] text-[var(--ink-black)] bauhaus-stroke"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {props.card.tokenId}
                  </code>
                  <CopyButton text={props.card.tokenId} label="token id" />
                </div>
              </div>
              <div className="p-3 bauhaus-stroke-r">
                <span
                  className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Network
                </span>
                <div className="mt-1 text-sm font-semibold">{props.card.chain}</div>
              </div>
              <div className="p-3">
                <span
                  className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Traits
                </span>
                <div className="mt-1 text-sm font-semibold">
                  {props.card.attributes.length || "0"}
                </div>
              </div>
            </div>

            {props.card.description ? (
              <div className="bauhaus-stroke bg-white p-3">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Description
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:rgba(45,26,18,0.86)]">
                  {clampText(props.card.description, 280)}
                </p>
              </div>
            ) : null}

            {props.card.attributes.length ? (
              <div className="bauhaus-stroke bg-white p-3">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Traits
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {props.card.attributes.slice(0, 14).map((a, idx) => (
                    <span
                      key={`${a.trait_type ?? "trait"}:${idx}`}
                      className="inline-flex items-center bg-[var(--bg-cream)] px-2 py-1 text-[11px] text-[var(--ink-black)] bauhaus-stroke"
                      style={{ fontFamily: "var(--font-mono)" }}
                      title={a.trait_type ?? undefined}
                    >
                      {a.trait_type ? `${a.trait_type}: ` : ""}
                      {String(a.value ?? "")}
                    </span>
                  ))}
                  {props.card.attributes.length > 14 ? (
                    <span
                      className="inline-flex items-center bg-[var(--bg-cream)] px-2 py-1 text-[11px] text-[var(--ink-black)] bauhaus-stroke"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      +{props.card.attributes.length - 14} more
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-auto flex flex-wrap gap-2">
              {props.card.explorerUrl ? (
                <a
                  href={props.card.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-none px-3 py-2 text-[11px] font-[var(--font-display)] uppercase tracking-wider bauhaus-stroke bg-[var(--ink-black)] text-[var(--bg-cream)] transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--ink-black)] active:translate-x-0 active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]"
                  data-no-flip
                >
                  Explorer
                </a>
              ) : null}
              {props.card.externalUrl ? (
                <a
                  href={props.card.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-none px-3 py-2 text-[11px] font-[var(--font-display)] uppercase tracking-wider bauhaus-stroke bg-[var(--bauhaus-yellow)] text-[var(--ink-black)] transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--ink-black)] active:translate-x-0 active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]"
                  data-no-flip
                >
                  External link
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
