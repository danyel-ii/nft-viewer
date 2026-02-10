import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

let cachedClient: ReturnType<typeof createPublicClient> | null = null;

function getMainnetClient() {
  if (cachedClient) return cachedClient;

  const key = process.env.ALCHEMY_KEY || process.env.ALCHEMY_API_KEY;
  const rpcUrl =
    process.env.RPC_URL ||
    (key ? `https://eth-mainnet.g.alchemy.com/v2/${key}` : undefined);
  if (!rpcUrl) {
    throw new Error(
      "RPC_URL is not set. It is required for ENS resolution on Ethereum mainnet.",
    );
  }

  cachedClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });
  return cachedClient;
}

export async function resolveEnsAddress(name: string) {
  const client = getMainnetClient();
  const address = await client.getEnsAddress({ name });
  return address ?? null;
}
