"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ChainName } from "@/lib/chains";
import { CHAIN_LABEL } from "@/lib/chains";
import type { NftApiResponse, NftCard } from "@/lib/types";

type AccentTheme = { red: string; yellow: string; blue: string };

const DEFAULT_ACCENTS: AccentTheme = {
  red: "#e2583e",
  yellow: "#ffb347",
  blue: "#8c3b32",
};

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHexByte(n: number) {
  const s = clampByte(n).toString(16).padStart(2, "0");
  return s;
}

function rgbToHex(rgb: { r: number; g: number; b: number }) {
  return `#${toHexByte(rgb.r)}${toHexByte(rgb.g)}${toHexByte(rgb.b)}`;
}

function hexToRgb(hex: string) {
  const s = hex.trim().toLowerCase();
  const m = /^#?([0-9a-f]{6})$/.exec(s);
  if (!m) return null;
  const v = m[1]!;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return { r, g, b };
}

function luminance01(rgb: { r: number; g: number; b: number }) {
  // Cheap approximation is fine here; we just need ordering.
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

function chroma01(rgb: { r: number; g: number; b: number }) {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  return (max - min) / 255;
}

function dist(rgbA: { r: number; g: number; b: number }, rgbB: { r: number; g: number; b: number }) {
  const dr = rgbA.r - rgbB.r;
  const dg = rgbA.g - rgbB.g;
  const db = rgbA.b - rgbB.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function extractPaletteFromImage(img: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  const w = 64;
  const h = 64;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Quantize to 4 bits/channel (4096 buckets).
  const counts = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 0;
    if (a < 32) continue;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const [key] of sorted.slice(0, 32)) {
    const r4 = (key >> 8) & 0xf;
    const g4 = (key >> 4) & 0xf;
    const b4 = key & 0xf;
    const rgb = { r: r4 * 16 + 8, g: g4 * 16 + 8, b: b4 * 16 + 8 };
    const hex = rgbToHex(rgb);
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
  }
  return out;
}

function buildAccentThemeFromPalette(palette: string[]): AccentTheme {
  const parsed = palette
    .map((hex) => ({ hex, rgb: hexToRgb(hex) }))
    .filter((x): x is { hex: string; rgb: { r: number; g: number; b: number } } => Boolean(x.rgb))
    .map((x) => ({ ...x, lum: luminance01(x.rgb), chroma: chroma01(x.rgb) }))
    .filter((x) => x.lum > 0.12 && x.lum < 0.92 && x.chroma > 0.06);

  const picked: { hex: string; rgb: { r: number; g: number; b: number }; lum: number }[] = [];
  for (const c of parsed) {
    if (picked.length >= 3) break;
    if (picked.some((p) => dist(p.rgb, c.rgb) < 70)) continue;
    picked.push({ hex: c.hex, rgb: c.rgb, lum: c.lum });
  }

  const fallbackPool = [
    DEFAULT_ACCENTS.red,
    DEFAULT_ACCENTS.yellow,
    DEFAULT_ACCENTS.blue,
  ]
    .map((hex) => ({ hex, rgb: hexToRgb(hex) }))
    .filter((x): x is { hex: string; rgb: { r: number; g: number; b: number } } => Boolean(x.rgb))
    .map((x) => ({ ...x, lum: luminance01(x.rgb) }));

  for (const f of fallbackPool) {
    if (picked.length >= 3) break;
    if (picked.some((p) => dist(p.rgb, f.rgb) < 70)) continue;
    picked.push({ hex: f.hex, rgb: f.rgb, lum: f.lum });
  }

  // Map: darkest -> "blue", lightest -> "yellow", middle -> "red" (matches our theme's vibe).
  const ordered = [...picked].sort((a, b) => a.lum - b.lum);
  const blue = ordered[0]?.hex ?? DEFAULT_ACCENTS.blue;
  const red = ordered[1]?.hex ?? DEFAULT_ACCENTS.red;
  const yellow = ordered[2]?.hex ?? DEFAULT_ACCENTS.yellow;
  return { red, yellow, blue };
}

function normalizeTokenIdForCompare(value: string) {
  const s = value.trim();
  if (!s) return "";
  if (/^0x[0-9a-fA-F]+$/.test(s)) {
    try {
      return BigInt(s).toString(10);
    } catch {
      return s.toLowerCase();
    }
  }
  if (/^[0-9]+$/.test(s)) return s.replace(/^0+(?=\d)/, "");
  return s.toLowerCase();
}

function parseCardId(value: string) {
  const s = value.trim();
  const parts = s.split(":");
  if (parts.length < 3) return null;
  const [chain, contract, ...rest] = parts;
  const tokenId = rest.join(":");
  if (!chain || !contract || !tokenId) return null;
  return {
    chain,
    contractAddress: contract.toLowerCase(),
    tokenId,
  };
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

function buildBackUrl(args: { chain: ChainName; wallet: string; hideSpam: boolean }) {
  const p = new URLSearchParams();
  p.set("chain", args.chain);
  if (args.wallet) p.set("wallet", args.wallet);
  if (args.hideSpam === false) p.set("hideSpam", "false");
  return `/?${p.toString()}`;
}

function PosterMedia(props: {
  card: NftCard;
  title: string;
  onTheme: (theme: AccentTheme) => void;
}) {
  const regionRef = useRef<HTMLDivElement | null>(null);
  const [regionSize, setRegionSize] = useState({ w: 0, h: 0 });
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });

  const imageAttemptUrls = useMemo(() => {
    const raw = [props.card.imageUrl, ...(props.card.imageFallbackUrls ?? [])].filter(
      Boolean,
    ) as string[];
    const base: string[] = [];
    const seenBase = new Set<string>();
    for (const url of raw) {
      if (seenBase.has(url)) continue;
      seenBase.add(url);
      base.push(url);
    }

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
  }, [props.card.imageFallbackUrls, props.card.imageUrl]);

  const [imgIndex, setImgIndex] = useState(0);
  const [imgLoadedUrl, setImgLoadedUrl] = useState<string | null>(null);
  const lastThemedUrlRef = useRef<string | null>(null);

  const mediaUrl = imageAttemptUrls[imgIndex] ?? null;
  const imgLoaded = Boolean(mediaUrl) && imgLoadedUrl === mediaUrl;

  useLayoutEffect(() => {
    const el = regionRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const next = { w: Math.round(rect.width), h: Math.round(rect.height) };
      setRegionSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    };

    update();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const windowStyle = useMemo(() => {
    const regionW = regionSize.w;
    const regionH = regionSize.h;
    const natW = imgNatural.w;
    const natH = imgNatural.h;

    const style: React.CSSProperties = {
      background: "white",
      overflow: "hidden",
      outline: "var(--stroke-width) solid var(--ink-black)",
      outlineOffset: "0px",
    };

    if (!regionW || !regionH) {
      style.width = "100%";
      style.height = "100%";
      return style;
    }

    // Before we know the image dimensions, just use the full region.
    if (!natW || !natH) {
      style.width = regionW;
      style.height = regionH;
      return style;
    }

    // Fit a same-aspect "window" inside the region. The window becomes the "image field",
    // so the image can fill it with no padding and no cropping.
    const aspect = natW / natH;
    const regionAspect = regionW / regionH;
    style.aspectRatio = `${natW} / ${natH}`;

    if (regionAspect > aspect) {
      // Region is wider than the image: height-limited.
      style.height = regionH;
      style.width = "auto";
    } else {
      // Region is taller/narrower than the image: width-limited.
      style.width = regionW;
      style.height = "auto";
    }

    return style;
  }, [imgNatural.h, imgNatural.w, regionSize.h, regionSize.w]);

  if (!mediaUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--bg-cream)]">
        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <div className="h-12 w-12 bg-[var(--bauhaus-yellow)] bauhaus-stroke" />
          <p className="text-sm font-[var(--font-display)] uppercase tracking-wide text-[var(--ink-black)]">
            No image available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={regionRef}
      className="absolute inset-0 z-10 flex items-start justify-center"
    >
      <div className="relative" style={windowStyle}>
        {!imgLoaded ? (
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-[linear-gradient(135deg,rgba(45,26,18,0.12),rgba(45,26,18,0.06),rgba(45,26,18,0.12))]" />
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={mediaUrl}
          src={mediaUrl}
          alt={props.title}
          className="block h-full w-full"
          style={{ objectFit: "fill" }}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={(e) => {
            setImgLoadedUrl(mediaUrl);
            setImgNatural({
              w: e.currentTarget.naturalWidth || 0,
              h: e.currentTarget.naturalHeight || 0,
            });

            // Palette extraction: best-effort. If the loaded URL is cross-origin and
            // taints canvas, we retry using either a CORS-enabled reload or the same-origin
            // media proxy.
            if (lastThemedUrlRef.current === mediaUrl) return;
            lastThemedUrlRef.current = mediaUrl;

            try {
              const palette = extractPaletteFromImage(e.currentTarget);
              const theme = buildAccentThemeFromPalette(palette);
              props.onTheme(theme);
            } catch {
              // If this is already same-origin, there's nothing else we can do here.
              if (mediaUrl.startsWith("/api/media?")) return;

              const proxy = toMediaProxyUrl(mediaUrl);

              const tryProxy = () => {
                if (!proxy) return;

                // Retry palette extraction from same-origin pixels.
                const img = new Image();
                img.decoding = "async";
                img.onload = () => {
                  if (lastThemedUrlRef.current === proxy) return;
                  lastThemedUrlRef.current = proxy;
                  try {
                    const palette = extractPaletteFromImage(img);
                    const theme = buildAccentThemeFromPalette(palette);
                    props.onTheme(theme);
                  } catch {
                    // ignore
                  }
                };
                img.src = proxy;
              };

              // Try a CORS-enabled reload first. If the upstream serves permissive CORS headers,
              // this avoids routing pixels through our proxy.
              const corsKey = `cors:${mediaUrl}`;
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.decoding = "async";
              img.onload = () => {
                if (lastThemedUrlRef.current === corsKey) return;
                lastThemedUrlRef.current = corsKey;
                try {
                  const palette = extractPaletteFromImage(img);
                  const theme = buildAccentThemeFromPalette(palette);
                  props.onTheme(theme);
                } catch {
                  tryProxy();
                }
              };
              img.onerror = () => tryProxy();
              img.src = mediaUrl;
            }
          }}
          onError={() => {
            setImgLoadedUrl(null);
            setImgNatural({ w: 0, h: 0 });
            setImgIndex((i) => Math.min(i + 1, imageAttemptUrls.length));
          }}
        />
      </div>
    </div>
  );
}

export function PrintPoster(props: {
  chain: ChainName;
  wallet: string;
  id: string;
  hideSpam: boolean;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [card, setCard] = useState<NftCard | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(DEFAULT_ACCENTS);
  const [artistOverrides, setArtistOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    const wallet = props.wallet.trim();
    const idRaw = props.id.trim();
    if (!wallet) {
      setState("error");
      setErrorMessage("Missing query params. Open this page from the main deck using Poster.");
      return;
    }

    let cancelled = false;
    const ac = new AbortController();

    async function run() {
      try {
        setState("loading");
        setErrorMessage(null);
        setCard(null);
        setResolvedAddress(null);
        setAccentTheme(DEFAULT_ACCENTS);
        setArtistOverrides({});

        const url = new URL("/api/nfts", window.location.origin);
        url.searchParams.set("chain", props.chain);
        url.searchParams.set("wallet", wallet);
        url.searchParams.set("hideSpam", props.hideSpam ? "true" : "false");

        const res = await fetch(url.toString(), { signal: ac.signal });
        const json = (await res.json()) as Partial<NftApiResponse> & { error?: string };
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);

        const cards = Array.isArray(json.cards) ? (json.cards as NftCard[]) : [];
        const decodedId = safeDecode(idRaw);
        const parsed = parseCardId(idRaw) ?? parseCardId(decodedId);
        const targetContract = parsed?.contractAddress ?? null;
        const targetToken = parsed?.tokenId
          ? normalizeTokenIdForCompare(parsed.tokenId)
          : null;

        const hit =
          // Exact id match (most reliable)
          cards.find((c) => c.id === idRaw) ??
          cards.find((c) => c.id === decodedId) ??
          // Fallback match by parts (handles odd encoding/tokenId formatting)
          (targetContract && targetToken
            ? cards.find(
                (c) =>
                  c.contractAddress.toLowerCase() === targetContract &&
                  normalizeTokenIdForCompare(c.tokenId) === targetToken,
              ) ?? null
            : null) ??
          // If no id was provided, default to the first NFT.
          (idRaw ? null : cards[0] ?? null);

        if (cancelled) return;

        if (!hit) {
          setState("error");
          setErrorMessage(
            idRaw
              ? "That NFT was not found for this wallet/network."
              : "No NFTs were found for this wallet/network.",
          );
          setCard(null);
          setResolvedAddress(
            typeof json.resolvedAddress === "string" ? json.resolvedAddress : null,
          );
          return;
        }

        setCard(hit);
        setResolvedAddress(
          typeof json.resolvedAddress === "string" ? json.resolvedAddress : null,
        );
        setState("ready");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unexpected error.";
        setState("error");
        setErrorMessage(msg);
        setCard(null);
        setResolvedAddress(null);
      }
    }

    void run();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [props.chain, props.hideSpam, props.id, props.wallet]);

  const title = card?.tokenName || (card ? `#${card.tokenId}` : "NFT");
  const collection = card?.collectionName || CHAIN_LABEL[props.chain];
  const backUrl = buildBackUrl({
    chain: props.chain,
    wallet: props.wallet,
    hideSpam: props.hideSpam,
  });

  const posterVars = useMemo(() => {
    return {
      "--bauhaus-red": accentTheme.red,
      "--bauhaus-yellow": accentTheme.yellow,
      "--bauhaus-blue": accentTheme.blue,
    } as React.CSSProperties;
  }, [accentTheme.blue, accentTheme.red, accentTheme.yellow]);

  const canEditArtist = Boolean(card && !card.artist);
  const manualArtist = card ? (artistOverrides[card.id] ?? "") : "";
  const artistForPrint = card?.artist ?? manualArtist;
  const tokenIdLarge = card?.tokenId ?? (state === "loading" ? "..." : "—");
  const headerBlurb = (() => {
    const raw = (card?.description ?? "").replace(/\s+/g, " ").trim();
    if (raw) return raw.length > 160 ? `${raw.slice(0, 157)}…` : raw;
    return "A Bauhaus-inspired print view for an on-chain collectible. The colors and shapes are themed from the NFT image.";
  })();

  return (
    <div
      className="relative min-h-dvh bg-[var(--bg-cream)] px-4 py-6 print-page"
      style={posterVars}
    >
      <div
        className="mx-auto print-container"
        style={{ width: "min(96vw, calc(92dvh * 210 / 297), 760px)" }}
      >
        <div className="print-hidden mb-4 flex flex-wrap items-center justify-between gap-3">
          <a
            href={backUrl}
            className="inline-flex h-11 items-center justify-center rounded-none px-4 text-[11px] font-[var(--font-display)] uppercase tracking-wider bauhaus-stroke bg-[var(--bg-cream)] text-[var(--ink-black)] transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--ink-black)] active:translate-x-0 active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]"
          >
            Back to deck
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-11 items-center justify-center rounded-none px-4 text-[11px] font-[var(--font-display)] uppercase tracking-wider bauhaus-stroke bg-[var(--bauhaus-red)] text-[var(--bg-cream)] transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--ink-black)] active:translate-x-0 active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]"
          >
            Print
          </button>
        </div>

	        <div
	          className="relative bauhaus-frame overflow-hidden bg-[var(--bg-cream)] print-frame mx-auto"
	          style={{
	            width: "min(96vw, calc(92dvh * 210 / 297), 760px)",
	            aspectRatio: "210 / 297",
	          }}
	        >
          <div className="relative z-10 grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-y-4 pt-4 px-4 pb-2 md:gap-y-5 md:pt-6 md:px-7 md:pb-3 print-content">
            <div className="min-h-0">
              <div className="grid grid-cols-[1fr_auto] items-start gap-4">
                <p
                  className="max-w-[420px] text-[9px] leading-[14px] text-[color:rgba(45,26,18,0.78)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {headerBlurb}
                </p>
                <div className="text-right">
                  <div className="font-[var(--font-display)] text-[56px] leading-none tracking-[-0.06em] text-[var(--ink-black)] md:text-[68px]">
                    {tokenIdLarge}
                  </div>
                  <div
                    className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[color:rgba(45,26,18,0.72)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {CHAIN_LABEL[props.chain]}
                  </div>
                </div>
              </div>

              <h1 className="mt-2 font-[var(--font-display)] text-[48px] leading-[0.82] tracking-[-0.06em] text-[var(--ink-black)] md:text-[56px]">
                {collection.toUpperCase()}
              </h1>

              {title !== collection ? (
                <div
                  className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:rgba(45,26,18,0.78)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {title}
                </div>
              ) : null}

              <div className="mt-1 flex flex-col gap-1">
                <div className="h-[3px] w-full bg-[var(--ink-black)]" />
                <div className="h-[3px] w-[90%] bg-[var(--ink-black)]" />
                <div className="h-[3px] w-[80%] bg-[var(--ink-black)]" />
              </div>
            </div>

            <div className="relative min-h-0 bg-[var(--bg-cream)]">
              {state === "loading" ? (
                <div className="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,rgba(45,26,18,0.12),rgba(45,26,18,0.06),rgba(45,26,18,0.12))]" />
              ) : null}

              {state === "ready" && card ? (
                <PosterMedia
                  key={card.id}
                  card={card}
                  title={title}
                  onTheme={(theme) => setAccentTheme(theme)}
                />
              ) : null}

              {state === "error" ? (
                <div className="flex h-full w-full items-center justify-center bg-[var(--bg-cream)]">
                  <div className="max-w-[560px] px-6 text-center">
                    <p className="font-[var(--font-display)] uppercase tracking-wide text-[var(--ink-black)]">
                      Poster unavailable
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:rgba(45,26,18,0.75)]">
                      {errorMessage ?? "Something went wrong."}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 px-4 pb-0 md:px-6">
              <div className="mx-auto grid grid-cols-2 gap-0 bauhaus-stroke bg-[var(--bg-cream)]">
                <div className="border-b-4 border-r-4 border-[var(--ink-black)] p-1">
                  <span
                    className="block text-[5px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Owner
                  </span>
                  <div className="mt-0.5 text-[7px] font-black text-[var(--ink-black)] break-all">
                    {resolvedAddress ?? props.wallet ?? "—"}
                  </div>
                </div>
                <div className="border-b-4 border-[var(--ink-black)] p-1">
                  <span
                    className="block text-[5px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Token
                  </span>
                  <div className="mt-0.5 text-[8px] font-black text-[var(--ink-black)]">
                    {card ? `#${card.tokenId}` : "—"}
                  </div>
                </div>
                <div className="border-r-4 border-[var(--ink-black)] p-1">
                  <span
                    className="block text-[5px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Contract
                  </span>
                  <div className="mt-0.5 text-[7px] font-black text-[var(--ink-black)] break-all">
                    {card ? card.contractAddress : "—"}
                  </div>
                </div>
                <div className="p-1">
                  <span
                    className="block text-[5px] font-semibold uppercase tracking-wider text-[var(--bauhaus-blue)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Artist
                  </span>
                  <div className="mt-0.5 text-[7px] font-black text-[var(--ink-black)]">
                    {card?.artist ? (
                      card.artist
                    ) : canEditArtist ? (
                      <>
                        <span className="print-only break-words">
                          {artistForPrint.trim() ? artistForPrint.trim() : "—"}
                        </span>
                        <input
                          className="print-hidden w-full bg-transparent text-[9px] text-[var(--ink-black)] placeholder:text-[color:rgba(45,26,18,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]"
                          style={{ fontFamily: "var(--font-mono)" }}
                          type="text"
                          value={manualArtist}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!card) return;
                            setArtistOverrides((prev) => ({
                              ...prev,
                              [card.id]: next,
                            }));
                          }}
                          placeholder="Type artist name"
                          aria-label="Artist name"
                        />
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="print-hidden mt-3 text-[11px] leading-5 text-[color:rgba(45,26,18,0.72)]">
          Tip: for best results, enable “Background graphics” in the print dialog.
        </p>
      </div>
    </div>
  );
}
