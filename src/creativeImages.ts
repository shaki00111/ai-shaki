export type CreativeImageKind = "avatar" | "duo" | "story" | "meme";

/** Text-to-image presets. These do not edit uploaded photos or guarantee text rendering. */
export function creativeImagePrompt(kind: CreativeImageKind, subject: string): string | null {
  const text = subject.trim();
  if (!text || text.length > 1000) return null;
  const presets: Record<CreativeImageKind, string> = {
    avatar: "Create a profile avatar from this description, with a centered subject and clear composition",
    duo: "Create a creative portrait of two people based on this description, showing both subjects clearly",
    story: "Create a social media story illustration based on this description, with a clean composition and room for a caption",
    meme: "Create a humorous meme-style illustration based on this description, without relying on legible text",
  };
  return `${presets[kind]}. User description: ${text}`;
}
