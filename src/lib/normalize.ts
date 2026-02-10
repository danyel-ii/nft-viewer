import type { ChainName } from "@/lib/chains";
import { CHAIN_EXPLORER_BASE_URL } from "@/lib/chains";
import { normalizeUrl, normalizeUrlToCandidates } from "@/lib/ipfs";
import type { NftAttribute, NftCard } from "@/lib/types";

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    const s = asString(v)?.trim();
    if (s) return s;
  }
  return null;
}

function normalizeUrlCandidates(...values: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const v of values) {
    const s = asString(v)?.trim();
    if (!s) continue;

    // Expand IPFS inputs to a few gateway candidates (for reliability).
    const candidates = normalizeUrlToCandidates(s);
    for (const normalized of candidates) {
      if (!normalized) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
  }

  return out;
}

function safeLowerHexAddress(addr: string | null): string | null {
  if (!addr) return null;
  const s = addr.trim();
  if (!s) return null;
  return s.toLowerCase();
}

function buildExplorerUrl(chain: ChainName, contract: string, tokenId: string) {
  const base = CHAIN_EXPLORER_BASE_URL[chain];
  const c = contract.toLowerCase();
  return `${base}/token/${c}?a=${encodeURIComponent(tokenId)}`;
}

function normalizeAttributes(raw: unknown): NftAttribute[] {
  const arr = asArray(raw);
  const out: NftAttribute[] = [];
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = entry as any;
    const trait_type = pickString(e.trait_type, e.traitType);
    const display_type = pickString(e.display_type, e.displayType);
    const value = e.value ?? null;
    out.push({ trait_type, display_type, value });
  }
  return out;
}

function normalizeArtistName(raw: unknown): string | null {
  const s = asString(raw)?.trim();
  if (!s) return null;
  // Avoid accidentally treating long addresses/hex strings as an "artist" label.
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return null;
  return s;
}

function extractArtistNameFromAttributes(attrs: NftAttribute[]): string | null {
  for (const a of attrs) {
    const trait = (a.trait_type ?? "").toString().trim().toLowerCase();
    if (!trait) continue;
    if (
      trait === "artist" ||
      trait.includes("artist") ||
      trait === "creator" ||
      trait.includes("creator") ||
      trait === "author" ||
      trait.includes("author")
    ) {
      const picked = normalizeArtistName(a.value);
      if (picked) return picked;
    }
  }
  return null;
}

function normalizeTokenId(value: unknown): string | null {
  const sRaw = asString(value);
  if (sRaw) {
    const s = sRaw.trim();
    if (!s) return null;

    // Some NFT APIs return token IDs as hex strings (e.g. "0x37").
    // Canonicalize to base-10 so IDs are stable across endpoints and easier to read.
    if (/^0x[0-9a-fA-F]+$/.test(s)) {
      try {
        return BigInt(s).toString(10);
      } catch {
        return s;
      }
    }

    // Strip leading zeros for decimal strings.
    if (/^[0-9]+$/.test(s)) return s.replace(/^0+(?=\d)/, "");

    return s;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return null;
}

export function normalizeAlchemyOwnedNftsToCards(args: {
  chain: ChainName;
  ownedNfts: unknown[];
}): NftCard[] {
  const { chain, ownedNfts } = args;
  const cards: NftCard[] = [];

  for (const rawNft of ownedNfts) {
    if (!rawNft || typeof rawNft !== "object") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nft = rawNft as any;

    const contractAddress = safeLowerHexAddress(
      pickString(nft?.contract?.address, nft.contractAddress, nft.contract_address),
    );
    if (!contractAddress) continue;

    const tokenId = normalizeTokenId(nft.tokenId ?? nft.token_id) ?? "0";

    const rawMeta = nft.raw?.metadata ?? nft.rawMetadata ?? nft.metadata ?? {};
    const rawMetaRec = asRecord(rawMeta);
    const rawMetaProps = rawMetaRec ? asRecord(rawMetaRec["properties"]) : null;

    const collectionName = pickString(nft?.contract?.name, nft?.contract?.symbol);
    const tokenName =
      pickString(nft.name, rawMeta?.name, rawMeta?.title) ?? (tokenId ? `#${tokenId}` : null);
    const description = pickString(nft.description, rawMeta?.description);

    const imageCandidates = normalizeUrlCandidates(
      nft?.image?.cachedUrl,
      nft?.image?.thumbnailUrl,
      nft?.image?.pngUrl,
      nft?.image?.originalUrl,
      rawMeta?.image,
      rawMeta?.image_url,
      rawMeta?.imageUrl,
    );

    const animationCandidates = normalizeUrlCandidates(
      nft?.animation?.cachedUrl,
      nft?.animation?.thumbnailUrl,
      nft?.animation?.originalUrl,
      rawMeta?.animation_url,
      rawMeta?.animationUrl,
      rawMeta?.animation,
      nft?.animationUrl,
      nft?.animation_url,
    );

    const imageUrl = imageCandidates[0] ?? null;
    const imageFallbackUrls = imageCandidates.slice(1);

    const animationUrl = animationCandidates[0] ?? null;
    const animationFallbackUrls = animationCandidates.slice(1);

    const externalUrl = normalizeUrl(
      pickString(rawMeta?.external_url, rawMeta?.externalUrl, nft?.tokenUri, nft?.token_uri),
    );
    const attributes = normalizeAttributes(rawMeta?.attributes ?? rawMeta?.traits);

    const artist =
      normalizeArtistName(
        pickString(
          rawMetaRec?.["artist"],
          rawMetaRec?.["artist_name"],
          rawMetaRec?.["artistName"],
          rawMetaRec?.["creator"],
          rawMetaRec?.["creator_name"],
          rawMetaRec?.["creatorName"],
          rawMetaRec?.["author"],
          rawMetaRec?.["author_name"],
          rawMetaRec?.["authorName"],
          rawMetaProps?.["artist"],
          rawMetaProps?.["creator"],
          rawMetaProps?.["author"],
        ),
      ) ?? extractArtistNameFromAttributes(attributes);

    const explorerUrl = buildExplorerUrl(chain, contractAddress, tokenId);
    const id = `${chain}:${contractAddress}:${tokenId}`;

    cards.push({
      id,
      chain,
      contractAddress,
      tokenId,
      collectionName,
      tokenName,
      description,
      artist,
      imageUrl,
      ...(imageFallbackUrls.length ? { imageFallbackUrls } : {}),
      animationUrl,
      ...(animationFallbackUrls.length ? { animationFallbackUrls } : {}),
      attributes,
      externalUrl,
      explorerUrl,
    });
  }

  return cards;
}
