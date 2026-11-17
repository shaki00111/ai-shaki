import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { readFileSync } from 'node:fs';
import { extractDocxText } from '../src/docxText.ts';
import { exportDocument } from '../src/exportEngine.ts';

const zip = xml => zipSync({ 'word/document.xml': strToU8(xml), 'other.txt': strToU8('ignored') });
const doc = text => `<?xml version="1.0"?><w:document xmlns:w="urn:word"><w:body>${text}</w:body></w:document>`;

test('extracts Persian and Latin Word paragraphs, tabs, breaks and XML entities', () => {
  const bytes = zip(doc('<w:p><w:r><w:t>سلام &amp; hello</w:t><w:tab/><w:t>world</w:t></w:r></w:p><w:p><w:t>عدد &#x6F1;</w:t><w:br/><w:t>&lt;end&gt;</w:t></w:p>'));
  const result = extractDocxText(bytes);
  assert.equal(result.text, 'سلام & hello\tworld\nعدد ۱\n<end>');
  assert.equal(result.truncated, false);
});

test('extracts a real DOCX produced by the existing SHAKI export engine', () => {
  const exported = exportDocument('سلام دنیا\n\nThis is a test.', { format: 'docx', lang: 'fa' });
  const result = extractDocxText(exported.bytes);
  assert.match(result.text, /سلام دنیا/);
  assert.match(result.text, /This is a test/);
});

test('large text is explicitly marked as truncated', () => {
  const result = extractDocxText(zip(doc(`<w:p><w:r><w:t>${'x'.repeat(40_000)}</w:t></w:r></w:p>`)));
  assert.equal(result.text.length, 30_000);
  assert.equal(result.truncated, true);
});

test('blocks oversized compressed XML even when highly compressible', () => {
  const archive = zip(doc(`<w:p><w:t>${'x'.repeat(2 * 1024 * 1024)}</w:t></w:p>`));
  assert.ok(archive.length < 30_000);
  assert.throws(() => extractDocxText(archive), /exceeds limit/);
});

test('decompression cap does not trust a forged local uncompressed size', () => {
  const archive = zip(doc(`<w:p><w:t>${'x'.repeat(2 * 1024 * 1024)}</w:t></w:p>`));
  const altered = archive.slice();
  const view = new DataView(altered.buffer, altered.byteOffset, altered.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  view.setUint32(22, 64, true);
  assert.throws(() => extractDocxText(altered), /exceeds limit/);
});

test('rejects missing text, invalid archives, invalid XML and entity declarations', () => {
  assert.throws(() => extractDocxText(new Uint8Array([1, 2, 3])), /invalid/i);
  assert.throws(() => extractDocxText(zipSync({ 'foo': strToU8('bar') })), /missing/i);
  assert.throws(() => extractDocxText(zip(doc('<w:p><w:t>oops</w:p>'))), /Invalid DOCX text/);
  assert.throws(() => extractDocxText(zip(doc('<!DOCTYPE foo><w:p><w:t>text</w:t></w:p>'))), /unsupported XML/);
  assert.throws(() => extractDocxText(zip(doc('<w:p><!-- bad <w:t>text</w:t></w:p>'))), /comment/);
});

test('does not treat comments as document text', () => {
  const result = extractDocxText(zip(doc('<!-- <w:p><w:t>fake</w:t></w:p> --><w:p><w:t>real</w:t></w:p>')));
  assert.equal(result.text, 'real');
});

test('both direct and replied DOCX paths extract real text instead of sending unsupported binary', () => {
  const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(source, /const isDocx =/);
  assert.match(source, /extractDocxText\(fileBytes\)/);
  assert.match(source, /extractDocxText\(new Uint8Array\(arrayBuf\)\)/);
});
