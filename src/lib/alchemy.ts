import type { ChainName } from "@/lib/chains";
import { cacheGetOrSet } from "@/lib/cache";

const CACHE_TTL_MS = 30_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 25;

type AlchemyPage = {
  ownedNfts?: unknown;
  pageKey?: unknown;
};

type AlchemyNftsResult = {
  ownedNfts: unknown[];
  truncated: boolean;
  warnings: string[];
};

class AlchemyHttpError extends Error {
  status: number;
  body: string;

  constructor(status: number, message: string, body: string) {
    super(message);
    this.name = "AlchemyHttpError";
    this.status = status;
    this.body = body;
  }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getAlchemyKey() {
  const key = process.env.ALCHEMY_KEY || process.env.ALCHEMY_API_KEY;
  if (!key) {
    throw new Error("ALCHEMY_KEY is not set on the server.");
  }
  return key;
}

function buildGetNftsForOwnerUrl(args: {
  chain: ChainName;
  apiKey: string;
  owner: string;
  pageKey: string | null;
  hideSpam: boolean;
}) {
  const url = new URL(
    `https://${args.chain}.g.alchemy.com/nft/v3/${args.apiKey}/getNFTsForOwner`,
  );
  url.searchParams.set("owner", args.owner);
  url.searchParams.set("withMetadata", "true");
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  if (args.pageKey) url.searchParams.set("pageKey", args.pageKey);
  if (args.hideSpam) url.searchParams.append("excludeFilters[]", "SPAM");
  return url;
}

async function fetchGetNftsForOwnerPage(args: {
  chain: ChainName;
  owner: string;
  apiKey: string;
  pageKey: string | null;
  hideSpam: boolean;
}): Promise<{ ownedNfts: unknown[]; pageKey: string | null }> {
  const url = buildGetNftsForOwnerUrl(args);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let body = text;
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        const rec = parsed as Record<string, unknown>;
        body = asString(rec["message"]) ?? asString(rec["error"]) ?? text;
      }
    } catch {
      // ignore
    }

    throw new AlchemyHttpError(
      res.status,
      `Alchemy request failed: ${res.status} ${res.statusText}${body ? ` (${body.slice(0, 200)})` : ""}`,
      body,
    );
  }

  const json = (await res.json()) as AlchemyPage;
  const ownedNfts = asArray(json?.ownedNfts);
  const pageKey = asString(json?.pageKey);
  return { ownedNfts, pageKey };
}

function isSpamFilterUnsupported(err: unknown) {
  if (!(err instanceof AlchemyHttpError)) return false;
  if (err.status !== 400 && err.status !== 401 && err.status !== 403) return false;
  const msg = `${err.message} ${err.body}`.toLowerCase();
  return (
    msg.includes("excludefilters") ||
    msg.includes("spam") ||
    msg.includes("paid tier") ||
    msg.includes("paid plan") ||
    msg.includes("upgrade")
  );
}

async function fetchAllOwnedNfts(args: {
  chain: ChainName;
  owner: string;
  apiKey: string;
  hideSpam: boolean;
}): Promise<{ ownedNfts: unknown[]; truncated: boolean }> {
  const ownedNfts: unknown[] = [];
  let pageKey: string | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchGetNftsForOwnerPage({
      chain: args.chain,
      owner: args.owner,
      apiKey: args.apiKey,
      pageKey,
      hideSpam: args.hideSpam,
    });

    ownedNfts.push(...res.ownedNfts);

    if (!res.pageKey) break;
    pageKey = res.pageKey;

    if (page === MAX_PAGES - 1) {
      truncated = true;
      break;
    }
  }

  return { ownedNfts, truncated };
}

export async function fetchAlchemyNftsForOwner(args: {
  chain: ChainName;
  owner: string;
  hideSpam: boolean;
}): Promise<AlchemyNftsResult> {
  const apiKey = getAlchemyKey();

  const chain = args.chain;
  const owner = args.owner.toLowerCase();
  const hideSpam = args.hideSpam;

  const cacheKey = `alchemy:getNFTsForOwner:${chain}:${owner}:${hideSpam ? "hide" : "show"}`;

  return cacheGetOrSet(cacheKey, CACHE_TTL_MS, async () => {
    const warnings: string[] = [];

    try {
      const { ownedNfts, truncated } = await fetchAllOwnedNfts({
        chain,
        owner,
        apiKey,
        hideSpam,
      });

      if (truncated) {
        warnings.push("Result set may be truncated due to pagination limits.");
      }

      return { ownedNfts, truncated, warnings };
    } catch (err) {
      if (hideSpam && isSpamFilterUnsupported(err)) {
        warnings.push(
          "Spam filtering is not available for this Alchemy plan/network; showing all NFTs.",
        );

        const { ownedNfts, truncated } = await fetchAllOwnedNfts({
          chain,
          owner,
          apiKey,
          hideSpam: false,
        });

        if (truncated) {
          warnings.push("Result set may be truncated due to pagination limits.");
        }

        return { ownedNfts, truncated, warnings };
      }

      throw err;
    }
  });
}
