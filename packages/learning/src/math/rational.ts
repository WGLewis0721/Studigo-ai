/** Exact fractions. BigInt throughout, so no comparison ever depends on floating point. */
export type Rational = { n: bigint; d: bigint };

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** Lowest terms with a positive denominator. Throws on a zero denominator; callers validate first. */
export function rational(n: bigint | number, d: bigint | number = 1): Rational {
  const num = BigInt(n);
  const den = BigInt(d);
  if (den === 0n) throw new RangeError("zero denominator");
  const divisor = gcd(num, den) || 1n;
  const sign = den < 0n ? -1n : 1n;
  return { n: (sign * num) / divisor, d: (sign * den) / divisor };
}

export const addRational = (a: Rational, b: Rational): Rational => rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const subtractRational = (a: Rational, b: Rational): Rational => rational(a.n * b.d - b.n * a.d, a.d * b.d);
export const equalRational = (a: Rational, b: Rational): boolean => a.n * b.d === b.n * a.d;
export const isWhole = (value: Rational): boolean => value.d === 1n;

/** True when the value has a finite decimal expansion, so a decimal can state it exactly. */
export function terminates(value: Rational): boolean {
  let d = value.d;
  for (const factor of [2n, 5n]) while (d % factor === 0n) d /= factor;
  return d === 1n;
}

export function formatRational(value: Rational): string {
  return isWhole(value) ? value.n.toString() : `${value.n}/${value.d}`;
}

export function lcm(a: number, b: number): number {
  return Number((BigInt(a) * BigInt(b)) / gcd(BigInt(a), BigInt(b)));
}
