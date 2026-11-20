import { Unzip, UnzipInflate } from "fflate";

const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;
const MAX_XML_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 30_000;
const MAX_FILES = 500;
const CHUNK_BYTES = 1024;

/** Decode the five XML entities and valid numeric references; never expand DTDs. */
function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    const lower = entity.toLowerCase();
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (named[lower]) return named[lower];
    const number = lower.startsWith("#x") ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
    return Number.isInteger(number) && number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
      ? String.fromCodePoint(number) : "�";
  });
}

/** Extract bounded plain text; DOCX layout, images, headers and footers are not analyzed. */
export function extractDocxText(bytes: Uint8Array): { text: string; truncated: boolean } {
  if (bytes.length < 22 || bytes.length > MAX_ARCHIVE_BYTES) throw new Error("DOCX archive size exceeds limit or is invalid");
  // Validate the end record before streaming; reject multi-disk and ZIP64.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0) throw new Error("Invalid DOCX ZIP directory");
  const count = view.getUint16(end + 10, true), diskCount = view.getUint16(end + 8, true);
  const directorySize = view.getUint32(end + 12, true), directoryOffset = view.getUint32(end + 16, true);
  if (count !== diskCount || count > MAX_FILES || count === 0xffff || directoryOffset + directorySize > end) throw new Error("Unsupported DOCX ZIP directory");

  let seen = 0, found = false, finished = false, size = 0;
  let failure: Error | undefined;
  const pieces: Uint8Array[] = [];
  const unzip = new Unzip(file => {
    if (++seen > MAX_FILES) { failure = new Error("Too many DOCX entries"); return; }
    if (file.name !== "word/document.xml") return;
    if (found || ![0, 8].includes(file.compression)) { failure = new Error("Invalid DOCX document entry"); return; }
    found = true;
    if (file.originalSize !== undefined && file.originalSize > MAX_XML_BYTES) { failure = new Error("DOCX content exceeds limit"); return; }
    file.ondata = (error, chunk, final) => {
      if (error) { failure = error; return; }
      if (failure) return;
      size += chunk?.length ?? 0;
      if (size > MAX_XML_BYTES) { failure = new Error("DOCX content exceeds limit"); return; }
      if (chunk?.length) pieces.push(chunk.slice());
      if (final) finished = true;
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    for (let i = 0; i < bytes.length; i += CHUNK_BYTES) {
      const end = Math.min(bytes.length, i + CHUNK_BYTES);
      unzip.push(bytes.subarray(i, end), end === bytes.length);
      if (failure) throw failure;
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error("Invalid DOCX archive");
  }
  if (!found || !finished || !size) throw new Error("DOCX document text is missing or incomplete");
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const part of pieces) { joined.set(part, offset); offset += part.length; }
  const xml = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(joined);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("DOCX document contains unsupported XML declarations");
  // Ignore comments in linear time before recognizing WordprocessingML tags.
  let clean = "", position = 0;
  while (position < xml.length) {
    const start = xml.indexOf("<!--", position);
    if (start < 0) { clean += xml.slice(position); break; }
    const endComment = xml.indexOf("-->", start + 4);
    if (endComment < 0) throw new Error("Invalid DOCX XML comment");
    clean += xml.slice(position, start);
    position = endComment + 3;
  }
  const tag = /<w:(t|tab|br|cr)(?=[\s/>])|<\/w:p\s*>/g;
  let result = "", match: RegExpExecArray | null, truncated = false;
  const append = (value: string) => {
    if (result.length + value.length > MAX_TEXT_CHARS) { result += value.slice(0, MAX_TEXT_CHARS - result.length); truncated = true; }
    else result += value;
  };
  while ((match = tag.exec(clean)) && !truncated) {
    if (!match[1]) { append("\n"); continue; }
    const close = clean.indexOf(">", tag.lastIndex);
    if (close < 0) throw new Error("Invalid DOCX XML");
    if (match[1] !== "t") { append(match[1] === "tab" ? "\t" : "\n"); tag.lastIndex = close + 1; continue; }
    if (clean[close - 1] === "/") { tag.lastIndex = close + 1; continue; }
    const endText = clean.indexOf("</w:t>", close + 1);
    if (endText < 0) throw new Error("Invalid DOCX text element");
    const content = clean.slice(close + 1, endText);
    if (content.includes("<")) throw new Error("Invalid DOCX text element");
    append(decodeXml(content));
    tag.lastIndex = endText + 6;
  }
  result = result.trim();
  if (!result) throw new Error("No readable text found in DOCX");
  return { text: result, truncated };
}
