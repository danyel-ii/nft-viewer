export type ChainName = "eth-mainnet" | "base-mainnet" | "celo-mainnet";

export const CHAIN_LABEL: Record<ChainName, string> = {
  "eth-mainnet": "Ethereum",
  "base-mainnet": "Base",
  "celo-mainnet": "Celo",
};

export const CHAIN_EXPLORER_BASE_URL: Record<ChainName, string> = {
  "eth-mainnet": "https://etherscan.io",
  "base-mainnet": "https://basescan.org",
  "celo-mainnet": "https://celoscan.io",
};

export const DEFAULT_CHAIN: ChainName = "eth-mainnet";

export function isChainName(value: unknown): value is ChainName {
  return (
    value === "eth-mainnet" ||
    value === "base-mainnet" ||
    value === "celo-mainnet"
  );
}

