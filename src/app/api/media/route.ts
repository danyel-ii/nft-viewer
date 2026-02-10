import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB safety cap
const FETCH_TIMEOUT_MS = 15_000;

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".");
  if (parts.length !== 4) return true;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;

  const [a, b] = nums;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 100.64.0.0/10 (carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // Benchmarking range (not publicly routable).
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15

  // Multicast + reserved.
  if (a >= 224) return true;

  return false;
}

function isPrivateIpv6(ip: string) {
  const s = ip.toLowerCase();

  // Loopback / unspecified.
  if (s === "::1" || s === "::") return true;

  // Link-local: fe80::/10
  if (s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb"))
    return true;

  // Unique local: fc00::/7
  if (s.startsWith("fc") || s.startsWith("fd")) return true;

  // Documentation prefix: 2001:db8::/32
  if (s.startsWith("2001:db8")) return true;

  return false;
}

function isPrivateAddress(ip: string) {
  const kind = net.isIP(ip);
  if (kind === 4) return isPrivateIpv4(ip);
  if (kind === 6) return isPrivateIpv6(ip);
  return true;
}

async function assertPublicHostname(hostname: string) {
  if (!hostname) throw new Error("Missing hostname.");

  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) {
    throw new Error("Blocked hostname.");
  }
  if (lower.endsWith(".local")) {
    throw new Error("Blocked hostname.");
  }

  // If the hostname is an IP literal, validate directly.
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("Blocked IP address.");
    return;
  }

  const addrs = await lookup(hostname, { all: true });
  if (!addrs.length) throw new Error("DNS lookup failed.");

  for (const a of addrs) {
    if (isPrivateAddress(a.address)) {
      throw new Error("Blocked private network address.");
    }
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("url") ?? url.searchParams.get("u");
  if (!raw) return jsonError(400, "Missing required query param 'url'.");

  let upstream: URL;
  try {
    upstream = new URL(raw);
  } catch {
    return jsonError(400, "Invalid 'url'. Must be an absolute URL.");
  }

  if (upstream.username || upstream.password) {
    return jsonError(400, "Invalid 'url'. Credentials are not allowed.");
  }

  if (upstream.protocol !== "https:") {
    return jsonError(400, "Invalid 'url'. Only https:// URLs are allowed.");
  }

  try {
    await assertPublicHostname(upstream.hostname);
  } catch {
    return jsonError(400, "Blocked 'url'.");
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(upstream, {
      headers: {
        Accept: "image/*,video/*,*/*;q=0.8",
      },
      cache: "no-store",
      signal: ac.signal,
    });

    if (!res.ok) {
      return jsonError(502, `Upstream returned ${res.status}.`);
    }

    const lenHeader = res.headers.get("content-length");
    if (lenHeader) {
      const len = Number(lenHeader);
      if (Number.isFinite(len) && len > MAX_BYTES) {
        return jsonError(413, "Upstream response too large.");
      }
    }

    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) {
      return jsonError(413, "Upstream response too large.");
    }

    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") ?? "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(ab, { status: 200, headers });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return jsonError(504, "Upstream timed out.");
    }
    return jsonError(502, "Upstream fetch failed.");
  } finally {
    clearTimeout(t);
  }
}
