import { describe, expect, it } from "vitest";

import { ipfsToHttps, normalizeUrl } from "@/lib/ipfs";

describe("ipfsToHttps", () => {
  it("converts ipfs://<cid> to gateway URL", () => {
    expect(ipfsToHttps("ipfs://bafybeigdyr")).toBe(
      "https://ipfs.io/ipfs/bafybeigdyr",
    );
  });

  it("handles ipfs://ipfs/<cid>/<path>", () => {
    expect(ipfsToHttps("ipfs://ipfs/QmHash/path/to.png")).toBe(
      "https://ipfs.io/ipfs/QmHash/path/to.png",
    );
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
      "https://ipfs.io/ipfs/QmHash/cat.png",
    );
    expect(normalizeUrl("/ipfs/QmHash/cat.png")).toBe(
      "https://ipfs.io/ipfs/QmHash/cat.png",
    );
  });
});

