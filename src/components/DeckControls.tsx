import clsx from "clsx";

function ControlButton(props: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  title: string;
  variant?: "default" | "accent" | "primary";
}) {
  const variant = props.variant ?? "default";
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={clsx(
        "inline-flex h-11 items-center justify-center rounded-none px-4 text-[11px] font-[var(--font-display)] uppercase tracking-wider transition",
        "bauhaus-stroke",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-black)]",
        "transition-transform",
        "hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--ink-black)]",
        "active:translate-x-0 active:translate-y-0 active:shadow-none",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none",
        variant === "default" && "bg-[var(--bg-cream)] text-[var(--ink-black)]",
        variant === "accent" && "bg-[var(--bauhaus-yellow)] text-[var(--ink-black)]",
        variant === "primary" && "bg-[var(--bauhaus-red)] text-[var(--bg-cream)]",
      )}
    >
      {props.children}
    </button>
  );
}

export function DeckControls(props: {
  disabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFlip: () => void;
  onShuffle: () => void;
  onPoster?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <ControlButton
        onClick={props.onPrev}
        disabled={props.disabled}
        title="Previous (←)"
      >
        Prev
      </ControlButton>
      <ControlButton
        onClick={props.onNext}
        disabled={props.disabled}
        title="Next (→)"
      >
        Next
      </ControlButton>
      <ControlButton
        onClick={props.onFlip}
        disabled={props.disabled}
        title="Flip (Space / Enter)"
        variant="accent"
      >
        Flip
      </ControlButton>
      <ControlButton
        onClick={props.onShuffle}
        disabled={props.disabled}
        title="Shuffle (S)"
        variant="primary"
      >
        Shuffle
      </ControlButton>
      {props.onPoster ? (
        <ControlButton
          onClick={props.onPoster}
          disabled={props.disabled}
          title="Open print poster view"
        >
          Poster
        </ControlButton>
      ) : null}
    </div>
  );
}
