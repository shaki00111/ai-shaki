/** A small, self-contained SVG quote card; no external assets or network calls. */
const MAX_INPUT = 360;
const MAX_LINE = 30;
const MAX_LINES = 12;

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function quoteCardSvg(input: string): string | null {
  // XML 1.0 forbids most control characters, including lone surrogates.
  const text = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").trim();
  if (!text || text.length > MAX_INPUT || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) return null;
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/u).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let line = "";
    for (const word of words) {
      const points = Array.from(word);
      while (points.length > MAX_LINE) {
        if (line) { lines.push(line); line = ""; }
        lines.push(points.splice(0, MAX_LINE).join(""));
      }
      const remainder = points.join("");
      if (line && Array.from(line + " " + remainder).length > MAX_LINE) {
        lines.push(line);
        line = "";
      }
      line = line ? `${line} ${remainder}` : remainder;
    }
    if (line) lines.push(line);
  }
  if (lines.length > MAX_LINES) return null;
  const rtl = /[\u0590-\u08FF]/u.test(text);
  const textX = rtl ? 790 : 110;
  const body = lines.map((line, i) =>
    `<text x="${textX}" y="${300 + i * 62}" direction="${rtl ? "rtl" : "ltr"}" text-anchor="start" unicode-bidi="plaintext">${escapeXml(line)}</text>`
  ).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#100c24"/><stop offset="1" stop-color="#111e3a"/></linearGradient><linearGradient id="accent"><stop stop-color="#a855f7"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs>
<rect width="900" height="1200" rx="42" fill="url(#bg)"/><rect x="60" y="60" width="780" height="1080" rx="32" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.18"/>
<rect x="110" y="150" width="120" height="7" rx="3" fill="url(#accent)"/>
<text x="110" y="210" font-family="sans-serif" font-size="27" font-weight="bold" fill="#c4b5fd">AI SHAKI</text>
<g font-family="Tahoma, Arial, sans-serif" font-size="40" fill="#f5f3ff">${body}</g>
<text x="110" y="1090" font-family="sans-serif" font-size="23" fill="#a5b4fc">A THOUGHT WORTH SHARING</text>
</svg>`;
}
