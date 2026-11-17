export type PhotoStyle = "anime" | "cartoon";

/** Only matches explicit Telegram commands addressed to this bot. */
export function parsePhotoStyleCommand(text: string, botUsername?: string): { style: PhotoStyle; detail: string } | null {
  const match = /^\/(anime|cartoon)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!match || (match[2] && botUsername && match[2].toLowerCase() !== botUsername.toLowerCase())) return null;
  return { style: match[1].toLowerCase() as PhotoStyle, detail: (match[3] ?? "").trim() };
}

export function photoStyleInstruction(style: PhotoStyle, detail: string): string | null {
  if (detail.length > 500) return null;
  const styleName = style === "anime" ? "anime illustration" : "cartoon illustration";
  return `Edit this replied image into ${style === "anime" ? "an" : "a"} ${styleName}. Preserve the people, identity, and composition.` +
    (detail ? ` Additional requested details: ${detail}` : "");
}
