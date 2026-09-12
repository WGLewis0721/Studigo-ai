import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNext, parseTestDate, assertIngestLimit, MAX_OCR_PAGES } from './validation';

test('auth next rejects alternate-origin, backslash, control and encoded redirects', () => {
  for (const input of ['//evil.example', '/\\evil.example', '/\\\\evil.example', 'https://evil.example', '/%5cevil.example', '/%2f%2fevil.example', '/\tevil.example', '/%0a/evil.example', ' /app', '/%zz', null]) assert.equal(safeNext(input), '/app');
  assert.equal(safeNext('/app/rooms/123?mode=quiz#review'), '/app/rooms/123?mode=quiz#review');
});
test('crafted room test dates fail before toISOString', () => {
  for (const value of ['bad','2026-02-30','2026-13-01','2026-1-1','2026-09-12T12:00:00Z',new File(['x'],'date')]) assert.throws(()=>parseTestDate(value));
  assert.equal(parseTestDate('2028-02-29'),'2028-02-29T00:00:00.000Z');
  assert.equal(parseTestDate(''), null);
});
test('OCR limit is explicit rather than truncated material marked ready', () => {
  assert.doesNotThrow(()=>assertIngestLimit(40,MAX_OCR_PAGES,'OCR pages'));
  assert.throws(()=>assertIngestLimit(41,MAX_OCR_PAGES,'OCR pages'), /Nothing has been marked ready/);
});
