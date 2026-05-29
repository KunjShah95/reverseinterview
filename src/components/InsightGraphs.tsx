import type { ReactNode } from "react";

type Slice = {
  label: string;
  value: number;
  color: string;
};

type SparkPoint = {
  label: string;
  value: number;
};

type BarDatum = {
  label: string;
  value: number;
  color: string;
  detail?: string;
};

function formatValue(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function buildConicGradient(slices: Slice[]) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);

  if (!total) {
    return "conic-gradient(#d9d4c7 0% 100%)";
  }

  let cursor = 0;
  const segments = slices
    .map((slice) => {
      const start = (cursor / total) * 100;
      cursor += Math.max(0, slice.value);
      const end = (cursor / total) * 100;
      return `${slice.color} ${start}% ${end}%`;
    })
    .join(", ");

  return `conic-gradient(${segments})`;
}

function toSvgPath(points: SparkPoint[], width: number, height: number) {
  if (!points.length) return { line: "", fill: "" };

  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const minValue = Math.min(...points.map((point) => point.value));
  const horizontalPadding = 8;
  const verticalPadding = 10;
  const innerWidth = width - horizontalPadding * 2;
  const innerHeight = height - verticalPadding * 2;
  const span = Math.max(1, maxValue - Math.min(0, minValue));

  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : horizontalPadding + (index / (points.length - 1)) * innerWidth;
    const normalized = (point.value - Math.min(0, minValue)) / span;
    const y = height - verticalPadding - normalized * innerHeight;
    return [x, y] as const;
  });

  const line = coordinates.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const fill = `${line} L ${width - horizontalPadding},${height - verticalPadding} L ${horizontalPadding},${height - verticalPadding} Z`;

  return { line, fill };
}

function CardShell({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-ink/10 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-ink" style={{ letterSpacing: "-0.025em" }}>
            {title}
          </h3>
          <p className="mt-1 text-sm text-body">{subtitle}</p>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-ink/10 bg-cream px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/70">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function DonutGraphCard({
  title,
  subtitle,
  slices,
  centerLabel,
  centerValue,
  footer,
  badge,
}: {
  title: string;
  subtitle: string;
  slices: Slice[];
  centerLabel: string;
  centerValue: string;
  footer?: string;
  badge?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);

  return (
    <CardShell title={title} subtitle={subtitle} badge={badge}>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
        <div className="mx-auto flex w-full max-w-[220px] items-center justify-center">
          <div
            className="relative h-52 w-52 rounded-full border border-ink/5 shadow-[0_20px_60px_rgba(31,42,29,0.08)]"
            style={{ background: buildConicGradient(slices) }}
          >
            <div className="absolute inset-8 rounded-full border border-white/80 bg-cream/95 shadow-[inset_0_1px_20px_rgba(31,42,29,0.05)]">
              <div className="flex h-full flex-col items-center justify-center text-center px-6">
                <p className="text-xs uppercase tracking-[0.2em] text-body/80">{centerLabel}</p>
                <p className="mt-2 font-display text-4xl text-ink" style={{ lineHeight: 0.95 }}>
                  {centerValue}
                </p>
                <p className="mt-2 text-xs text-body/80">
                  {total ? `${total} saved reports` : "No reports yet"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {slices.map((slice) => {
            const percent = total ? Math.round((slice.value / total) * 100) : 0;
            return (
              <div
                key={slice.label}
                className="rounded-2xl border border-ink/10 bg-cream/40 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                    <span className="font-medium text-ink truncate">{slice.label}</span>
                  </div>
                  <span className="font-semibold text-ink">{slice.value}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/70 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percent}%`, backgroundColor: slice.color }}
                  />
                </div>
              </div>
            );
          })}
          {footer ? <p className="pt-2 text-xs leading-relaxed text-body">{footer}</p> : null}
        </div>
      </div>
    </CardShell>
  );
}

export function SparklineGraphCard({
  title,
  subtitle,
  points,
  badge,
  lineColor,
  fillColor,
  valueSuffix,
}: {
  title: string;
  subtitle: string;
  points: SparkPoint[];
  badge?: string;
  lineColor: string;
  fillColor: string;
  valueSuffix?: string;
}) {
  const { line, fill } = toSvgPath(points, 360, 160);
  const latest = points.length ? points[points.length - 1].value : 0;
  const peak = points.length ? Math.max(...points.map((point) => point.value)) : 0;
  const start = points.length ? points[0].value : 0;

  return (
    <CardShell title={title} subtitle={subtitle} badge={badge}>
      <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <div>
          <svg viewBox="0 0 360 160" className="h-52 w-full overflow-visible" role="img" aria-label={title}>
            <defs>
              <linearGradient id={`fill-${title.replace(/\s+/g, "-").toLowerCase()}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={fillColor} stopOpacity="0.36" />
                <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2].map((lineIndex) => (
              <line
                key={lineIndex}
                x1="10"
                x2="350"
                y1={40 + lineIndex * 40}
                y2={40 + lineIndex * 40}
                stroke="rgba(31,42,29,0.08)"
                strokeDasharray="4 6"
              />
            ))}
            {fill ? <path d={fill} fill={`url(#fill-${title.replace(/\s+/g, "-").toLowerCase()})`} /> : null}
            {line ? <path d={line} fill="none" stroke={lineColor} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" /> : null}
            {points.map((point, index) => {
              const { line: pointLine } = toSvgPath(points, 360, 160);
              const coords = pointLine
                .split(" ")
                .filter(Boolean)
                .map((segment) => segment.slice(1).split(",").map(Number));
              const [x, y] = coords[index] ?? [180, 80];
              return <circle key={point.label} cx={x} cy={y} r="5" fill={lineColor} stroke="white" strokeWidth="3" />;
            })}
          </svg>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-ink/10 bg-cream/40 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-body/70">Current</p>
            <p className="mt-1 font-display text-4xl text-ink" style={{ lineHeight: 0.95 }}>
              {formatValue(latest)}
              {valueSuffix ?? ""}
            </p>
            <p className="mt-2 text-xs text-body">
              Peak {formatValue(peak)}{valueSuffix ?? ""} · Started at {formatValue(start)}{valueSuffix ?? ""}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {points.map((point) => (
              <div key={point.label} className="rounded-2xl border border-ink/10 bg-white px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-body/70">{point.label}</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {formatValue(point.value)}{valueSuffix ?? ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

export function BarGraphCard({
  title,
  subtitle,
  bars,
  badge,
}: {
  title: string;
  subtitle: string;
  bars: BarDatum[];
  badge?: string;
}) {
  const peak = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <CardShell title={title} subtitle={subtitle} badge={badge}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {bars.map((bar) => {
          const height = Math.max(12, Math.round((bar.value / peak) * 100));
          return (
            <div key={bar.label} className="rounded-2xl border border-ink/10 bg-cream/30 p-4">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-body/70">{bar.label}</p>
                  {bar.detail ? <p className="mt-1 text-xs text-body">{bar.detail}</p> : null}
                </div>
                <p className="text-lg font-display text-ink">{formatValue(bar.value)}</p>
              </div>
              <div className="mt-4 flex h-32 items-end rounded-2xl bg-white/70 p-2">
                <div
                  className="w-full rounded-[1.1rem] shadow-[0_16px_30px_rgba(31,42,29,0.14)]"
                  style={{ height: `${height}%`, backgroundColor: bar.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}
