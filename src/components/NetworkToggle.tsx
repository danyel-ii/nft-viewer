import type { ChainName } from "@/lib/chains";
import { CHAIN_LABEL } from "@/lib/chains";
import clsx from "clsx";

const CHAINS: ChainName[] = ["eth-mainnet", "base-mainnet", "celo-mainnet"];

export function NetworkToggle(props: {
  chain: ChainName;
  onChange: (chain: ChainName) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-none bg-[var(--bg-cream)] bauhaus-stroke divide-x-4 divide-[var(--ink-black)]">
      {CHAINS.map((c) => {
        const active = c === props.chain;
        return (
          <button
            key={c}
            type="button"
            onClick={() => props.onChange(c)}
            className={clsx(
              "px-4 py-2 text-[11px] font-semibold uppercase tracking-wider transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]",
              active
                ? "bg-[var(--ink-black)] text-[var(--bg-cream)]"
                : "text-[var(--ink-black)] hover:bg-[color:rgba(226,88,62,0.10)]",
            )}
            aria-pressed={active}
          >
            {CHAIN_LABEL[c]}
          </button>
        );
      })}
    </div>
  );
}
