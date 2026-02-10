"use client";

import { useId } from "react";

export function WalletSearchBar(props: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-black)]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Wallet address or ENS
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          id={id}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              props.onSubmit();
            }
          }}
          placeholder='0xabc… or "vitalik.eth"'
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 w-full flex-1 rounded-none bg-white px-4 text-sm text-[var(--ink-black)] outline-none bauhaus-stroke placeholder:text-[color:rgba(45,26,18,0.55)] focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]"
          style={{ fontFamily: "var(--font-mono)" }}
        />
        <button
          type="button"
          onClick={props.onSubmit}
          disabled={props.isLoading}
          className="h-12 rounded-none px-5 text-[11px] font-[var(--font-display)] uppercase tracking-wider bauhaus-stroke bg-[var(--bauhaus-red)] text-[var(--bg-cream)] transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--ink-black)] active:translate-x-0 active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {props.isLoading ? "Loading…" : "Load NFTs"}
        </button>
      </div>
      <p className="text-xs leading-5 text-[color:rgba(45,26,18,0.72)]">
        Tip: try the same wallet on different networks.
      </p>
    </div>
  );
}
