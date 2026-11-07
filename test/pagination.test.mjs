import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePageNumber, buildPaginatedUrl } from '../dist/index.js';

const config = { baseUrl: 'https://shop.example.com' };

test('page parser accepts positive decimal strings within its inclusive bound', () => {
  for (const [input, expected] of [['1', 1], ['42', 42], ['0002', 2], ['999999', 999999]]) {
    assert.equal(parsePageNumber(input, { max: 999999 }), expected);
  }
  assert.equal(parsePageNumber(String(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
  assert.equal(parsePageNumber('1000000', { max: 999999, fallback: 3 }), 3);
});

test('page parser rejects malformed, non-string, unsafe and nonpositive inputs', () => {
  for (const input of [undefined, null, 2, true, {}, ['2'], '', ' ', ' 2', '2 ', '0',
    '-1', '+1', '1.5', '1e2', '0x10', 'Infinity', 'NaN', '2x', '9007199254740992']) {
    assert.equal(parsePageNumber(input), 1, String(input));
  }
});

test('page parser rejects invalid bounds and fallback', () => {
  for (const options of [{ max: 0 }, { max: -1 }, { max: 1.5 }, { max: Infinity },
    { max: Number.MAX_SAFE_INTEGER + 1 }, { max: '3' }, { fallback: 0 },
    { fallback: '2' }, { fallback: NaN }, { max: 2, fallback: 3 }]) {
    assert.throws(() => parsePageNumber('1', options), RangeError);
  }
});

test('pagination preserves actual filters, repeated values, encoding and fragment', () => {
  const url = new URL(buildPaginatedUrl('/items?color=red&color=blue&q=a%2Bb&page=8&page=9#grid', 2, config));
  assert.equal(url.origin, config.baseUrl);
  assert.deepEqual(url.searchParams.getAll('color'), ['red', 'blue']);
  assert.equal(url.searchParams.get('q'), 'a+b');
  assert.deepEqual(url.searchParams.getAll('page'), ['2']);
  assert.equal(url.hash, '#grid');
});

test('first page removes only the selected pagination parameter', () => {
  assert.equal(buildPaginatedUrl('/items?page=4&page=5&sort=new', 1, config),
    'https://shop.example.com/items?sort=new');
  assert.equal(buildPaginatedUrl('/items?p=3&page=7', 1, config, { pageParameter: 'p' }),
    'https://shop.example.com/items?page=7');
  assert.equal(buildPaginatedUrl('/items', 3, config, { pageParameter: 'p' }),
    'https://shop.example.com/items?p=3');
  assert.equal(buildPaginatedUrl('/items', 1, config), 'https://shop.example.com/items');
});

test('paths use standard URL resolution and same-origin absolute URLs are supported', () => {
  assert.equal(buildPaginatedUrl('items', 2, { baseUrl: 'https://shop.example.com/store/' }),
    'https://shop.example.com/store/items?page=2');
  assert.equal(buildPaginatedUrl('https://shop.example.com/items', 2, config),
    'https://shop.example.com/items?page=2');
});

test('pagination rejects invalid pages, configuration, paths and query keys', () => {
  for (const page of [0, -1, 1.2, NaN, Infinity, '2', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => buildPaginatedUrl('/items', page, config), RangeError);
  }
  for (const badConfig of [undefined, {}, { baseUrl: '/relative' }, { baseUrl: 'ftp://shop.example.com' },
    { baseUrl: 'https://user:password@shop.example.com' }]) {
    assert.throws(() => buildPaginatedUrl('/items', 2, badConfig), TypeError);
  }
  for (const path of ['', ' ', undefined, 'https://other.example/items', '//other.example/items',
    'https://user@shop.example.com/items', 'javascript:alert(1)', 'http://shop.example.com/items']) {
    assert.throws(() => buildPaginatedUrl(path, 2, config), TypeError);
  }
  for (const pageParameter of ['', ' ', 'a b', 'a\nb', 4]) {
    assert.throws(() => buildPaginatedUrl('/items', 2, config, { pageParameter }), TypeError);
  }
});
