const VOICES = Object.freeze({
  Thiha: { id: null, label: 'Thiha', language: 'my-MM', supported: false, provider: 'google-gemini-tts' },
  Puck: { id: 'Puck', label: 'Puck', language: 'my-MM', supported: true, provider: 'google-gemini-tts' },
  Charon: { id: 'Charon', label: 'Charon', language: 'my-MM', supported: true, provider: 'google-gemini-tts' },
  Fenrir: { id: 'Fenrir', label: 'Fenrir', language: 'my-MM', supported: true, provider: 'google-gemini-tts' },
  Aoede: { id: 'Aoede', label: 'Aoede', language: 'my-MM', supported: true, provider: 'google-gemini-tts' },
  Kore: { id: 'Kore', label: 'Kore', language: 'my-MM', supported: true, provider: 'google-gemini-tts' },
  Leda: { id: 'Leda', label: 'Leda', language: 'my-MM', supported: true, provider: 'google-gemini-tts' }
});

const DEFAULT_VOICE = 'Puck';
const MAX_TEXT_LENGTH = 12000;
const MAX_BODY_BYTES = 40000;
const MIN_AUDIO_BYTES = 500;
const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
    .replace(/[\uD800-\uDFFF]/gu, '')
    .replace(/[\[\]{}]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function parseVoice(value) {
  const voice = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_VOICE;
  return Object.prototype.hasOwnProperty.call(VOICES, voice) ? voice : null;
}

function parsePitch(value) {
  if (value === undefined || value === null || value === '') return 0;
  const raw = String(value).trim();
  if (!/^-?\d+$/.test(raw)) return null;
  const pitch = Number(raw);
  if (!Number.isInteger(pitch) || pitch < -20 || pitch > 20) return null;
  return pitch;
}

function pitchInstruction(pitch) {
  if (pitch === 0) return '';
  return ` Adjust the perceived pitch by ${pitch > 0 ? 'raising' : 'lowering'} it approximately ${Math.abs(pitch)} percent.`;
}

function looksLikeAudio(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < MIN_AUDIO_BYTES) return false;
  const header = buffer.subarray(0, 4).toString('ascii');
  return header === 'RIFF' || header === 'OggS' || header === 'ID3' || buffer[0] === 0xff;
}

function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const blockAlign = channels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function extractAudio(data) {
  const part = data?.candidates?.[0]?.content?.parts?.find((item) => item.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error('Gemini returned no audio content');
  const mimeType = String(part.inlineData.mimeType || '').toLowerCase();
  const bytes = Buffer.from(part.inlineData.data, 'base64');
  if (mimeType.includes('audio/wav') || mimeType.includes('audio/wave') || mimeType.includes('audio/mpeg') || mimeType.includes('audio/ogg')) return bytes;
  const rate = Number(mimeType.match(/rate[= ](\d+)/)?.[1]) || 24000;
  const channels = Number(mimeType.match(/channels?[= ](\d+)/)?.[1]) || 1;
  return pcmToWav(bytes, rate, channels, 16);
}

async function synthesizeGemini(text, voice, pitch) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('TTS service is not configured: GEMINI_API_KEY is missing');
  const model = process.env.GEMINI_TTS_MODEL || DEFAULT_TTS_MODEL;
  const config = VOICES[voice];
  const prompt = text;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `You are a Burmese narration voice. Read the user text exactly as written in natural spoken Burmese. Do not translate it, summarize it, explain it, add a greeting, or speak any instruction. Preserve Burmese words, punctuation, and scene order.${pitchInstruction(pitch)}` }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.id } } }
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gemini returned HTTP ${response.status}`);
  const audio = extractAudio(data);
  if (!looksLikeAudio(audio)) throw new Error('Gemini returned an invalid audio response');
  return audio;
}

async function readJsonBody(req) {
  if (!req.body) {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk.toString();
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new Error('Request body is too large');
    }
    if (!raw.trim()) return {};
    try { return JSON.parse(raw); } catch { throw new Error('Request body must be valid JSON'); }
  }
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { throw new Error('Request body must be valid JSON'); }
  }
  return req.body;
}

function readInput(req) {
  if (req.method === 'GET') {
    const url = new URL(req.url || '/', `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || 'localhost'}`);
    return { text: url.searchParams.get('text'), voice: url.searchParams.get('voice'), pitch: url.searchParams.get('pitch') };
  }
  return readJsonBody(req).then((body) => ({ text: body.text, voice: body.voice, pitch: body.pitch }));
}

async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  let input;
  try { input = await readInput(req); } catch (error) { return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid request' }); }
  const text = sanitizeText(input.text || 'မင်္ဂလာပါ');
  const voice = parseVoice(input.voice);
  const pitch = parsePitch(input.pitch);
  if (!text) return json(res, 400, { error: 'Text is required after sanitization' });
  if (!voice) return json(res, 400, { error: 'Unknown voice', supportedVoices: Object.keys(VOICES) });
  if (pitch === null) return json(res, 400, { error: 'Pitch must be an integer from -20 to 20' });
  const config = VOICES[voice];
  if (!config.supported) {
    return json(res, 422, {
      error: `${voice} is not available in the current TTS provider`,
      voice,
      provider: config.provider,
      supportedVoices: Object.keys(VOICES).filter((name) => VOICES[name].supported),
      nextStep: 'Choose a provider-supported voice or configure a provider adapter that explicitly supports this voice.'
    });
  }
  try {
    const audio = await synthesizeGemini(text, voice, pitch);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', String(audio.byteLength));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-TTS-Engine', config.provider);
    res.setHeader('X-TTS-Voice', voice);
    return res.end(audio);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown TTS error';
    console.error('[RECAST TTS]', detail);
    const quota = /quota|rate.?limit|free.?tier|too many requests/i.test(detail);
    return json(res, quota ? 429 : 502, { error: quota ? 'Gemini TTS quota is temporarily exhausted' : 'Voice generation failed', detail, voice, retryable: quota });
  }
}

module.exports = handler;
module.exports.RECAST_VOICES = VOICES;
