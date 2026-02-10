import { describe, expect, it } from "vitest";

import { ipfsToHttps, ipfsToHttpsCandidates, normalizeUrl, normalizeUrlToCandidates } from "@/lib/ipfs";

describe("ipfsToHttps", () => {
  it("converts ipfs://<cid> to gateway URL", () => {
    expect(ipfsToHttps("ipfs://bafybeigdyr")).toBe(
      "https://nftstorage.link/ipfs/bafybeigdyr",
    );
  });

  it("handles ipfs://ipfs/<cid>/<path>", () => {
    expect(ipfsToHttps("ipfs://ipfs/QmHash/path/to.png")).toBe(
      "https://nftstorage.link/ipfs/QmHash/path/to.png",
    );
  });
});

describe("ipfsToHttpsCandidates", () => {
  it("returns multiple gateway URLs for an ipfs:// uri", () => {
    expect(ipfsToHttpsCandidates("ipfs://QmHash/cat.png")).toEqual([
      "https://nftstorage.link/ipfs/QmHash/cat.png",
      "https://w3s.link/ipfs/QmHash/cat.png",
      "https://ipfs.io/ipfs/QmHash/cat.png",
    ]);
  });
});

describe("normalizeUrl", () => {
  it("returns null for empty", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
  });

  it("passes through https URLs", () => {
    expect(normalizeUrl("https://example.com/a.png")).toBe(
      "https://example.com/a.png",
    );
  });

  it("normalizes common ipfs path variants", () => {
    expect(normalizeUrl("ipfs/QmHash/cat.png")).toBe(
      "https://nftstorage.link/ipfs/QmHash/cat.png",
    );
    expect(normalizeUrl("/ipfs/QmHash/cat.png")).toBe(
      "https://nftstorage.link/ipfs/QmHash/cat.png",
    );
  });
});

describe("normalizeUrlToCandidates", () => {
  it("returns a single trimmed non-ipfs URL", () => {
    expect(normalizeUrlToCandidates(" https://example.com/a.png ")).toEqual([
      "https://example.com/a.png",
    ]);
  });

  it("expands https gateway /ipfs/<cid> URLs into multiple gateway candidates", () => {
    expect(
      normalizeUrlToCandidates("https://ipfs.io/ipfs/QmHash/cat.png?filename=cat.png"),
    ).toEqual([
      "https://nftstorage.link/ipfs/QmHash/cat.png?filename=cat.png",
      "https://w3s.link/ipfs/QmHash/cat.png?filename=cat.png",
      "https://ipfs.io/ipfs/QmHash/cat.png?filename=cat.png",
    ]);
  });
});
