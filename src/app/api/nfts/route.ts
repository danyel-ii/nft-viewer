import { NextResponse } from "next/server";
import { isAddress } from "viem";

import { isChainName, type ChainName } from "@/lib/chains";
import { fetchAlchemyNftsForOwner } from "@/lib/alchemy";
import { resolveEnsAddress } from "@/lib/ens";
import { normalizeAlchemyOwnedNftsToCards } from "@/lib/normalize";

export const runtime = "nodejs";

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function parseHideSpam(value: string | null) {
  if (value === null) return true;
  const s = value.trim().toLowerCase();
  return !(s === "0" || s === "false" || s === "no" || s === "off");
}

async function resolveWalletInput(walletInput: string) {
  if (walletInput.toLowerCase().endsWith(".eth")) {
    const addr = await resolveEnsAddress(walletInput);
    if (!addr) return null;
    return addr;
  }

  if (!isAddress(walletInput)) return null;
  return walletInput;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chainRaw = url.searchParams.get("chain");
  const walletRaw = url.searchParams.get("wallet");
  const hideSpam = parseHideSpam(url.searchParams.get("hideSpam"));

  if (!chainRaw || !isChainName(chainRaw)) {
    return jsonError(
      400,
      "Invalid 'chain'. Expected one of: eth-mainnet, base-mainnet, celo-mainnet.",
    );
  }
  const chain: ChainName = chainRaw;

  if (!walletRaw) {
    return jsonError(400, "Missing required query param 'wallet'.");
  }
  const walletInput = walletRaw.trim();
  if (!walletInput) {
    return jsonError(400, "Wallet input cannot be empty.");
  }

  try {
    const resolvedAddress = await resolveWalletInput(walletInput);
    if (!resolvedAddress) {
      return jsonError(
        400,
        "Invalid wallet. Enter a 0x… address or an ENS name like vitalik.eth.",
      );
    }

    const { ownedNfts, truncated, warnings } = await fetchAlchemyNftsForOwner({
      chain,
      owner: resolvedAddress,
      hideSpam,
    });

    const cards = normalizeAlchemyOwnedNftsToCards({ chain, ownedNfts });

    return NextResponse.json(
      {
        chain,
        walletInput,
        resolvedAddress,
        count: cards.length,
        cards,
        ...(truncated ? { truncated: true } : {}),
        ...(warnings.length ? { warnings } : {}),
      },
      { status: 200 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected server error.";

    // Hide implementation details from clients for security.
    if (message.includes("ALCHEMY_KEY")) {
      return jsonError(
        500,
        "Server is missing ALCHEMY_KEY. Add it to .env.local and restart the dev server.",
      );
    }
    if (message.includes("RPC_URL")) {
      return jsonError(
        500,
        "Server is missing RPC_URL for ENS resolution. Add it to .env.local, or use a 0x… address.",
      );
    }

    if (
      message.startsWith("Alchemy request failed: 401") ||
      message.startsWith("Alchemy request failed: 403")
    ) {
      return jsonError(
        502,
        "Alchemy authentication failed. Check your ALCHEMY_KEY and try again.",
      );
    }
    if (message.startsWith("Alchemy request failed: 429")) {
      return jsonError(502, "Rate limited by provider. Please try again soon.");
    }
    if (message.startsWith("Alchemy request failed: 404")) {
      return jsonError(
        502,
        "Alchemy endpoint not found for this network. This network may not be supported for NFT indexing.",
      );
    }

    return jsonError(502, "Upstream provider error. Please try again soon.");
  }
}
