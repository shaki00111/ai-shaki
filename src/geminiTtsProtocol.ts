export interface GeminiTtsAudioOutput {
  data: string;
  mimeType: string;
}

export interface GeminiTtsRequest {
  model: string;
  input: string | Array<{
    type: "user_input";
    content: Array<{ type: "text"; text: string }>;
  }>;
  response_format: { type: "audio" };
  generation_config: {
    speech_config: Array<{ voice: string }>;
  };
}

/** Build the documented Interactions API payload for current Gemini TTS models. */
export function buildGeminiTtsRequest(model: string, text: string, voice: string): GeminiTtsRequest {
  const input = model.startsWith("gemini-3.8-")
    ? [{ type: "user_input" as const, content: [{ type: "text" as const, text }] }]
    : text;
  return {
    model,
    input,
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice }] },
  };
}

/** Normalize Interactions API audio results across snake_case/camelCase responses. */
export function extractGeminiTtsAudio(response: unknown): GeminiTtsAudioOutput | null {
  if (!response || typeof response !== "object") return null;
  const root = response as Record<string, any>;
  const outputAudio = (root.output_audio ?? root.outputAudio) as Record<string, any> | undefined;
  let data = outputAudio?.data;
  let mimeType = outputAudio?.mime_type ?? outputAudio?.mimeType ?? "";

  if (typeof data !== "string" && Array.isArray(root.output)) {
    const block = root.output.find((item: any) => item?.type === "audio" || item?.output_audio);
    const nested = block?.output_audio ?? block;
    data = nested?.data;
    mimeType = nested?.mime_type ?? nested?.mimeType ?? mimeType;
  }

  // The current raw REST Interactions response exposes audio under
  // steps[].content[] (the SDK's output_audio convenience field is not
  // guaranteed to be present in REST responses).
  if (typeof data !== "string" && Array.isArray(root.steps)) {
    for (let i = root.steps.length - 1; i >= 0 && typeof data !== "string"; i--) {
      const step = root.steps[i];
      if (!Array.isArray(step?.content)) continue;
      const block = step.content.find((item: any) =>
        item?.type === "audio" || typeof item?.data === "string"
      );
      if (!block) continue;
      const nested = block.output_audio ?? block;
      data = nested?.data;
      mimeType = nested?.mime_type ?? nested?.mimeType ?? mimeType;
    }
  }

  if (typeof data !== "string" || data.length < 100) return null;
  const normalizedMimeType = typeof mimeType === "string" && mimeType.trim()
    ? mimeType.trim()
    : "audio/wav";
  return { data, mimeType: normalizedMimeType };
}


/** Keep the preview TTS fallback only until its announced 2026-11-17 shutdown. */
export function getGeminiTtsModels(now = Date.now()): string[] {
  const models = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"];
  if (now < Date.UTC(2026, 10, 17)) models.push("gemini-3.1-flash-tts-preview");
  return models;
}
