import type { MathModel } from "@/lib/math-model";

const FRACTION_SUM = /^(\d)\s*\/\s*(\d)\s*\+\s*(\d)\s*\/\s*(\d)$/;
const DIGIT_SUM = /^(\d)\s*\+\s*(\d)$/;

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function lcm(a: number, b: number): number {
  return (Math.abs(a) / gcd(a, b)) * Math.abs(b);
}

/**
 * Fraction bars or a number line drawn from the parsed model.
 * The caption is the text equivalent; the picture is not loaded from anywhere.
 */
export function MathModelView({ model }: { model: MathModel }) {
  const drawing = model.kind === "number-line"
    ? <NumberLine model={model} />
    : model.kind === "fraction-bar"
      ? <FractionBars model={model} />
      : <AreaSketch />;

  return (
    <figure className="mathModel" style={{ margin: 0 }}>
      <svg
        aria-hidden="true"
        viewBox={model.kind === "number-line" ? "0 0 320 84" : "0 0 320 148"}
        width="320"
        height={model.kind === "number-line" ? 84 : 148}
        fill="none"
      >
        {drawing}
      </svg>
      <figcaption>{caption(model)}</figcaption>
    </figure>
  );
}

function FractionBars({ model }: { model: MathModel }) {
  const parsed = model.prompt.match(FRACTION_SUM);
  if (!parsed) return null;
  const a = Number(parsed[1]);
  const b = Number(parsed[2]);
  const c = Number(parsed[3]);
  const d = Number(parsed[4]);
  const common = lcm(b, d);
  const filled = a * (common / b) + c * (common / d);

  return (
    <>
      <FractionBar y={8} numerator={a} denominator={b} label={`${a}/${b}`} />
      <FractionBar y={52} numerator={c} denominator={d} label={`${c}/${d}`} />
      <FractionBar y={96} numerator={filled} denominator={common} label={null} />
    </>
  );
}

function FractionBar({
  y,
  numerator,
  denominator,
  label
}: {
  y: number;
  numerator: number;
  denominator: number;
  label: string | null;
}) {
  const x = 56;
  const width = 240;
  const height = 28;
  const parts = Math.max(denominator, 1);
  const part = width / parts;
  const filled = Math.max(0, Math.min(parts, numerator));

  return (
    <g>
      {label ? (
        <text x="48" y={y + 19} textAnchor="end" fontSize="13" fill="currentColor" fontFamily="var(--sans, ui-sans-serif)">
          {label}
        </text>
      ) : null}
      <rect x={x} y={y} width={width} height={height} fill="var(--snow-2, #eef1f6)" />
      {filled > 0 ? (
        <rect x={x} y={y} width={part * filled} height={height} fill="var(--tone, #3c7cff)" />
      ) : null}
      {Array.from({ length: parts - 1 }, (_, index) => (
        <line
          key={index}
          x1={x + part * (index + 1)}
          x2={x + part * (index + 1)}
          y1={y}
          y2={y + height}
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
      <rect x={x} y={y} width={width} height={height} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </g>
  );
}

function NumberLine({ model }: { model: MathModel }) {
  const parsed = model.prompt.match(DIGIT_SUM);
  const left = parsed ? Number(parsed[1]) : 0;
  const right = parsed ? Number(parsed[2]) : model.answer;
  const end = Math.max(0, left + right);
  const x0 = 20;
  const span = 280;
  const y = 40;
  const xAt = (value: number) => x0 + (end === 0 ? span / 2 : (value / end) * span);

  return (
    <g stroke="currentColor" fill="none">
      <line x1={x0} x2={x0 + span} y1={y} y2={y} strokeWidth="1.5" />
      {Array.from({ length: end + 1 }, (_, value) => {
        const x = xAt(value);
        return (
          <g key={value}>
            <line x1={x} x2={x} y1={y - 8} y2={y + 8} strokeWidth="1.5" />
            <text x={x} y={y + 24} textAnchor="middle" fontSize="12" stroke="none" fill="currentColor" fontFamily="var(--sans, ui-sans-serif)">
              {value}
            </text>
          </g>
        );
      })}
      <Jump from={xAt(0)} to={xAt(left)} y={y} />
      <Jump from={xAt(left)} to={xAt(end)} y={y} />
    </g>
  );
}

function Jump({ from, to, y }: { from: number; to: number; y: number }) {
  if (to === from) return null;
  const mid = (from + to) / 2;
  const lift = Math.min(28, Math.max(12, Math.abs(to - from) / 4));
  return (
    <path
      d={`M ${from} ${y - 8} Q ${mid} ${y - 8 - lift} ${to} ${y - 8}`}
      stroke="var(--tone, #3c7cff)"
      strokeWidth="1.5"
      fill="none"
    />
  );
}

function AreaSketch() {
  return (
    <rect x="56" y="24" width="200" height="100" fill="var(--snow-2, #eef1f6)" stroke="currentColor" strokeWidth="1.5" />
  );
}

function caption(model: MathModel): string {
  const fractions = model.prompt.match(FRACTION_SUM);
  if (model.kind === "fraction-bar" && fractions) {
    const a = fractions[1];
    const b = fractions[2];
    const c = fractions[3];
    const d = fractions[4];
    return `Fraction bars for ${a}/${b} + ${c}/${d}. The first bar has ${b} equal parts with ${a} filled. The second bar has ${d} equal parts with ${c} filled. A third bar lines equal parts up and fills the combined amount.`;
  }

  const digits = model.prompt.match(DIGIT_SUM);
  if (model.kind === "number-line" && digits) {
    const a = Number(digits[1]);
    const b = Number(digits[2]);
    return `Number line for ${a} + ${b}, drawn from 0 to ${a + b}, with a jump of ${a} and then a jump of ${b}.`;
  }

  return model.prompt;
}
