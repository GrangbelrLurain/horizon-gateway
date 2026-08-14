interface OverviewHelpPopoverProps {
  id: string;
  ariaLabel: string;
  whyTitle: string;
  why: string;
  onTitle: string;
  on: string;
  offTitle: string;
  off: string;
}

export function OverviewHelpPopover({
  id,
  ariaLabel,
  whyTitle,
  why,
  onTitle,
  on,
  offTitle,
  off,
}: OverviewHelpPopoverProps) {
  const anchor = `--${id}`;
  return (
    <>
      <button
        type="button"
        className="inline-flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-base-200 p-0 text-[10px] font-semibold leading-none text-base-content/55 hover:bg-base-300 hover:text-base-content/75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-base-content/25"
        popoverTarget={id}
        style={{ anchorName: anchor } as React.CSSProperties}
        aria-label={ariaLabel}
      >
        ?
      </button>
      <div
        id={id}
        popover="auto"
        className="dropdown dropdown-bottom rounded-box border border-base-300 bg-base-100 p-3 shadow-lg w-72 text-left"
        style={{ positionAnchor: anchor } as React.CSSProperties}
      >
        <dl className="space-y-2.5">
          <div>
            <dt className="text-xs font-semibold text-base-content">{whyTitle}</dt>
            <dd className="mt-0.5 text-[11px] leading-relaxed text-base-content/70">{why}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-base-content">{onTitle}</dt>
            <dd className="mt-0.5 text-[11px] leading-relaxed text-base-content/70">{on}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-base-content">{offTitle}</dt>
            <dd className="mt-0.5 text-[11px] leading-relaxed text-base-content/70">{off}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}
