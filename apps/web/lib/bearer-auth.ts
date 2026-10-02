export function readBearer(header: string | null): { kind: 'absent' } | { kind: 'invalid' } | { kind: 'bearer'; token: string } {
  if (header === null) return { kind: 'absent' };
  const match = header.match(/^Bearer ([A-Za-z0-9._~-]+)$/i);
  return match ? { kind: 'bearer', token: match[1] } : { kind: 'invalid' };
}
