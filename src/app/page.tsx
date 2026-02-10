import { NftDeckApp } from "@/components/NftDeckApp";
import { DEFAULT_CHAIN, isChainName } from "@/lib/chains";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home(props: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const sp = (await props.searchParams) ?? {};
  const chainRaw = sp.chain;
  const walletRaw = sp.wallet;

  const chain =
    typeof chainRaw === "string" && isChainName(chainRaw) ? chainRaw : DEFAULT_CHAIN;
  const wallet = typeof walletRaw === "string" ? walletRaw : "";

  return <NftDeckApp initialChain={chain} initialWallet={wallet} />;
}
