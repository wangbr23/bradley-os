import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

interface PanelShellProps extends HTMLAttributes<HTMLDivElement> {
  glyph: string;
  eyebrow: string;
  title: string;
  statValue: string;
  statLabel: string;
  afterStat?: ReactNode;
  rows: ReactNode;
  footer: ReactNode;
}

// Shared chrome for every board panel: index-card border, watermark glyph,
// drag-handle header, headline stat. react-grid-layout clones its grid items
// to inject ref/style/className/mouse handlers (and, when resizable, a
// `children` prop carrying the resize-handle element) — this forwards all of
// that onto the card's root element rather than owning drag/resize itself.
// Row content comes in via `rows`, not JSX children, specifically so that
// incoming `children` stays free for react-resizable's injected handle to
// render — an explicit JSX children slot here would silently shadow it.
export const PanelShell = forwardRef<HTMLDivElement, PanelShellProps>(
  function PanelShell(
    {
      glyph,
      eyebrow,
      title,
      statValue,
      statLabel,
      afterStat,
      rows,
      footer,
      children,
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={`panel-card${className ? ` ${className}` : ""}`}
        {...rest}
      >
        <span className="panel-watermark" aria-hidden="true">
          {glyph}
        </span>

        <div className="panel-drag-handle">
          <p className="panel-eyebrow">{eyebrow}</p>
          <p className="panel-title">{title}</p>
        </div>

        <div className="panel-stat">
          <span className="panel-stat-num">{statValue}</span>
          <span className="panel-stat-label">{statLabel}</span>
        </div>

        {afterStat}

        <div className="panel-rows">{rows}</div>

        <div className="panel-footer">{footer}</div>

        {children}
      </div>
    );
  },
);
