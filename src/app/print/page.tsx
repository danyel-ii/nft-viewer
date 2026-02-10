import { PrintPoster } from "@/components/PrintPoster";
import { DEFAULT_CHAIN, isChainName } from "@/lib/chains";

type SearchParams = Record<string, string | string[] | undefined>;

function parseHideSpam(value: string | undefined) {
  if (value === undefined) return true;
  const s = value.trim().toLowerCase();
  return !(s === "0" || s === "false" || s === "no" || s === "off");
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function PrintPage(props: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const sp = (await props.searchParams) ?? {};

  const chainRaw = sp.chain;
  const walletRaw = sp.wallet;
  const idRaw = sp.id;
  const hideSpamRaw = sp.hideSpam;

  const chain =
    typeof chainRaw === "string" && isChainName(chainRaw) ? chainRaw : DEFAULT_CHAIN;

  const wallet = typeof walletRaw === "string" ? safeDecode(walletRaw) : "";
  const id = typeof idRaw === "string" ? safeDecode(idRaw) : "";
  const hideSpam = parseHideSpam(typeof hideSpamRaw === "string" ? hideSpamRaw : undefined);

  return <PrintPoster chain={chain} wallet={wallet} id={id} hideSpam={hideSpam} />;
}
