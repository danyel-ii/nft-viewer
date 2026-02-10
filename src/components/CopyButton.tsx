"use client";

import { useEffect, useState } from "react";

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for older browsers / permission edge cases.
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "true");
  el.style.position = "absolute";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

export function CopyButton(props: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 900);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      className="inline-flex items-center rounded-none px-2 py-1 text-[11px] font-semibold uppercase tracking-wider bauhaus-stroke bg-[var(--ink-black)] text-[var(--bg-cream)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0_var(--ink-black)] active:translate-x-0 active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]"
      onClick={async () => {
        try {
          await copyToClipboard(props.text);
          setCopied(true);
        } catch {
          // Ignore; user can still select+copy manually.
        }
      }}
      aria-label={props.label ? `Copy ${props.label}` : "Copy"}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
