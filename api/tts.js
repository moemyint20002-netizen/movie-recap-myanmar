import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * RECAST TTS voice catalog.
 *
 * Only voices explicitly available from the selected Edge/Bing endpoint are
 * marked as supported. The UI may display the full product catalog, but the
 * API must not silently pretend that unsupported provider voice names are
 * distinct voices.
 */
export const RECAST_VOICES = {
  Thiha: {
    id: "my-MM-ThihaNeural",
    label: "Thiha",
    language: "my-MM",
    supported: true,
    provider: "edge-burmese",
  },
  Nilar: {
    id: "my-MM-NilarNeural",
    label: "Nilar",
    language: "my-MM",
    supported: true,
    provider: "edge-burmese",
  },
  Puck: {
    id: null,
    label: "Puck",
    language: "en-US",
    supported: false,
    provider: "google-gemini",
  },
  Charon: {
    id: null,
    label: "Charon",
    language: "en-US",
    supported: false,
    provider: "google-gemini",
  },
  Fenrir: {
    id: null,
    label: "Fenrir",
    language: "en-US",
    supported: false,
    provider: "google-gemini",
  },
  Aoede: {
    id: null,
    label: "Aoede",
    language: "en-US",
    supported: false,
    provider: "google-gemini",
  },
  Kore: {
    id: null,
    label: "Kore",
    language: "en-US",
    supported: false,
    provider: "google-gemini",
  },
  Leda: {
    id: null,
    label: "Leda",
    language: "en-US",
    supported: false,
    provider: "google-gemini",
  },
} as const;

export type RecastVoice = keyof typeof RECAST_VOICES;

const DEFAULT_VOICE: RecastVoice = "Thiha";
const MAX_TEXT_LENGTH = 4_000;
const MIN_AUDIO_BYTES = 500;
const EDGE_TTS_URL =
  "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/readaloud/v1";
const EDGE_TRUSTED_CLIENT_TOKEN = process.env.EDGE_TTS_TRUSTED_CLIENT_TOKEN;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[#*🔥🎬⚡\[\]]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function parseVoice(value: unknown): RecastVoice {
  const candidate = typeof value === "string" ? value : DEFAULT_VOICE;
  return Object.hasOwn(RECAST_VOICES, candidate)
    ? (candidate as RecastVoice)
    : DEFAULT_VOICE;
}

function parsePitch(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(-20, Math.min(20, Math.trunc(parsed)));
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, character => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}

function pitchValue(pitch: number): string {
  if (pitch === 0) return "medium";
  return `${pitch > 0 ? "+" : ""}${pitch}%`;
}

function requestQuery(req: IncomingMessage): URLSearchParams {
  const host = req.headers.host ?? "localhost";
  const protocol = (req.headers["x-forwarded-proto"] as string | undefined) ?? "http";
  return new URL(req.url ?? "/", `${protocol}://${host}`).searchParams;
}

async function synthesizeThiha(text: string, pitch: number): Promise<Buffer> {
  if (!EDGE_TRUSTED_CLIENT_TOKEN) {
    throw new Error("TTS service is not configured: EDGE_TTS_TRUSTED_CLIENT_TOKEN is missing");
  }

  const ssml = [
    "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='my-MM'>",
    "<voice name='my-MM-ThihaNeural'>",
    `<prosody pitch='${pitchValue(pitch)}' rate='+0%'>${escapeXml(text)}</prosody>`,
    "</voice>",
    "</speak>",
  ].join("");

  const response = await fetch(
    `${EDGE_TTS_URL}?TrustedClientToken=${encodeURIComponent(EDGE_TRUSTED_CLIENT_TOKEN)}`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "RECAST/1.0",
      },
      body: ssml,
    },
  );

  if (!response.ok) {
    throw new Error(`TTS provider returned HTTP ${response.status}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < MIN_AUDIO_BYTES) {
    throw new Error("TTS provider returned an empty or incomplete audio response");
  }
  return audio;
}

/**
 * Node-compatible handler. Mount this route as GET /api/tts.
 *
 * Supported query parameters:
 *   text=မင်္ဂလာပါ
 *   voice=Thiha
 *   pitch=-10..20
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "Method not allowed" });
  }

  const query = requestQuery(req);
  const text = cleanText(query.get("text") ?? "မင်္ဂလာပါ");
  const voice = parseVoice(query.get("voice"));
  const pitch = parsePitch(query.get("pitch"));
  const voiceConfig = RECAST_VOICES[voice];

  if (!text) {
    return json(res, 400, { error: "Text is required" });
  }

  if (!voiceConfig.supported || voice !== "Thiha") {
    return json(res, 422, {
      error: `${voice} is not available in the current Burmese TTS engine`,
      voice,
      supportedVoices: ["Thiha", "Nilar"],
      nextStep:
        "Configure a compatible provider adapter before enabling this voice in production.",
    });
  }

  try {
    const audio = await synthesizeThiha(text, pitch);
    res.statusCode = 200;
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audio.byteLength.toString());
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-TTS-Engine", "edge-burmese");
    res.setHeader("X-TTS-Voice", "Thiha");
    res.end(audio);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown TTS error";
    console.error("[RECAST TTS]", message);
    return json(res, 502, {
      error: "Voice generation failed",
      detail: message,
      voice: "Thiha",
    });
  }
}
