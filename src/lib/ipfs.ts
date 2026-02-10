const DEFAULT_IPFS_GATEWAYS = [
  // Generally reliable public gateways.
  "https://nftstorage.link/ipfs/",
  "https://w3s.link/ipfs/",
  "https://ipfs.io/ipfs/",
];

const DEFAULT_IPFS_GATEWAY = DEFAULT_IPFS_GATEWAYS[0];

function extractIpfsPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  // ipfs://<cid>, ipfs://<cid>/<path>, ipfs://ipfs/<cid>/<path>
  if (lower.startsWith("ipfs://")) {
    const withoutScheme = trimmed.slice("ipfs://".length);
    const path = withoutScheme.startsWith("ipfs/")
      ? withoutScheme.slice("ipfs/".length)
      : withoutScheme;
    return path.replace(/^\/+/, "");
  }

  // Common broken-ish variants sometimes seen in NFT metadata.
  if (lower.startsWith("ipfs/")) return trimmed.slice("ipfs/".length).replace(/^\/+/, "");
  if (lower.startsWith("/ipfs/")) return trimmed.slice("/ipfs/".length).replace(/^\/+/, "");

  // Already a gateway URL, but path-based: https://<gateway>/ipfs/<cid>/<path>
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.pathname.toLowerCase().startsWith("/ipfs/")) {
      const rest = u.pathname.slice("/ipfs/".length).replace(/^\/+/, "");
      return `${rest}${u.search ?? ""}`;
    }
  } catch {
    // ignore
  }

  return null;
}

export function ipfsToHttps(
  uri: string,
  gatewayBase: string = DEFAULT_IPFS_GATEWAY,
): string {
  const path = extractIpfsPath(uri);
  if (!path) return uri.trim();
  return gatewayBase + path;
}

export function ipfsToHttpsCandidates(
  uri: string,
  gatewayBases: string[] = DEFAULT_IPFS_GATEWAYS,
): string[] {
  const path = extractIpfsPath(uri);
  if (!path) return [];
  return gatewayBases.map((g) => g + path);
}

export function normalizeUrl(input?: string | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  const path = extractIpfsPath(s);
  if (path) return DEFAULT_IPFS_GATEWAY + path;

  return s;
}

export function normalizeUrlToCandidates(input?: string | null): string[] {
  if (!input) return [];
  const s = input.trim();
  if (!s) return [];

  const path = extractIpfsPath(s);
  if (!path) return [s];

  // Preserve order. First gateway is the primary.
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of DEFAULT_IPFS_GATEWAYS.map((g) => g + path)) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}
