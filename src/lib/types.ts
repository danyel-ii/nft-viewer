import type { ChainName } from "@/lib/chains";

export type NftAttribute = {
  trait_type?: string | null;
  value?: string | number | boolean | null;
  display_type?: string | null;
};

export type NftCard = {
  id: string;
  chain: ChainName;
  contractAddress: string;
  tokenId: string;

  collectionName: string | null;
  tokenName: string | null;
  description: string | null;

  artist: string | null;

  imageUrl: string | null;
  imageFallbackUrls?: string[];
  animationUrl: string | null;
  animationFallbackUrls?: string[];

  attributes: NftAttribute[];

  externalUrl: string | null;
  explorerUrl: string | null;
};

export type NftApiResponse = {
  chain: ChainName;
  walletInput: string;
  resolvedAddress: string;
  count: number;
  cards: NftCard[];
  truncated?: boolean;
  warnings?: string[];
};
