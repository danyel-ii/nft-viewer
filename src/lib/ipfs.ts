const DEFAULT_IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export function ipfsToHttps(
  uri: string,
  gatewayBase: string = DEFAULT_IPFS_GATEWAY,
): string {
  const trimmed = uri.trim();
  if (!trimmed) return "";

  if (!trimmed.toLowerCase().startsWith("ipfs://")) return trimmed;

  // Examples:
  // ipfs://<cid>
  // ipfs://<cid>/<path>
  // ipfs://ipfs/<cid>/<path>
  const withoutScheme = trimmed.slice("ipfs://".length);
  const path = withoutScheme.startsWith("ipfs/")
    ? withoutScheme.slice("ipfs/".length)
    : withoutScheme;

  return gatewayBase + path.replace(/^\/+/, "");
}

export function normalizeUrl(input?: string | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  if (s.toLowerCase().startsWith("ipfs://")) return ipfsToHttps(s);

  // Common broken-ish variants sometimes seen in NFT metadata.
  if (s.toLowerCase().startsWith("ipfs/")) return ipfsToHttps(`ipfs://${s}`);
  if (s.toLowerCase().startsWith("/ipfs/"))
    return ipfsToHttps(`ipfs://${s.slice(1)}`);

  return s;
}
