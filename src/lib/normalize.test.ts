import { describe, expect, it } from "vitest";

import { normalizeAlchemyOwnedNftsToCards } from "@/lib/normalize";

describe("normalizeAlchemyOwnedNftsToCards", () => {
  it("normalizes hex tokenIds to base-10 strings", () => {
    const cards = normalizeAlchemyOwnedNftsToCards({
      chain: "eth-mainnet",
      ownedNfts: [
        {
          contract: { address: "0xAbC000000000000000000000000000000000dEf0" },
          tokenId: "0x37",
          raw: { metadata: {} },
        },
      ],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.tokenId).toBe("55");
    expect(cards[0]?.id).toBe(
      "eth-mainnet:0xabc000000000000000000000000000000000def0:55",
    );
  });

  it("strips leading zeros from decimal tokenIds", () => {
    const cards = normalizeAlchemyOwnedNftsToCards({
      chain: "base-mainnet",
      ownedNfts: [
        {
          contract: { address: "0x0000000000000000000000000000000000000000" },
          tokenId: "00055",
          raw: { metadata: {} },
        },
      ],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.tokenId).toBe("55");
    expect(cards[0]?.id).toBe(
      "base-mainnet:0x0000000000000000000000000000000000000000:55",
    );
  });
});

