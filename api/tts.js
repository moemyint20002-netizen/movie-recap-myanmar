const VOICES = Object.freeze({
  Thiha: { id: 'my-MM-ThihaNeural', label: 'Thiha', language: 'my-MM', supported: true, provider: 'edge-burmese' },
  Puck: { id: null, label: 'Puck', language: 'en-US', supported: false, provider: 'google-gemini' },
  Charon: { id: null, label: 'Charon', language: 'en-US', supported: false, provider: 'google-gemini' },
  Fenrir: { id: null, label: 'Fenrir', language: 'en-US', supported: false, provider: 'google-gemini' },
  Aoede: { id: null, label: 'Aoede', language: 'en-US', supported: false, provider: 'google-gemini' },
  Kore: { id: null, label: 'Kore', language: 'en-US', supported: false, provider: 'google-gemini' },
  Leda: { id: null, label: 'Leda', language: 'en-US', supported: false, provider: 'google-gemini' }
});

const DEFAULT_VOICE = 'Thiha';
const MAX_TEXT_LENGTH = 4000;
const MAX_BODY_BYTES = 16000;
const MIN_AUDIO_BYTES = 500;
const EDGE_TTS_URL = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/readaloud/v1';

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

function escapeXml(value) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[character]));
}

function pitchValue(pitch) {
  return pitch === 0 ? 'medium' : `${pitch > 0 ? '+' : ''}${pitch}%`;
}

function looksLikeAudio(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < MIN_AUDIO_BYTES) return false;
  const header = buffer.subarray(0, 4).toString('ascii');
  return header === 'ID3' || buffer[0] === 0xff || header === 'RIFF' || header === 'OggS';
}

function requestUrl(req) {
  const host = req.headers.host || 'localhost';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  return new URL(req.url || '/', `${protocol}://${host}`);
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

async function readInput(req) {
  if (req.method === 'GET') {
    const query = requestUrl(req).searchParams;
    return { text: query.get('text'), voice: query.get('voice'), pitch: query.get('pitch') };
  }
  const body = await readJsonBody(req);
  return { text: body.text, voice: body.voice, pitch: body.pitch };
}

async function synthesizeThiha(text, pitch) {
  const token = process.env.EDGE_TTS_TRUSTED_CLIENT_TOKEN;
  if (!token) throw new Error('TTS service is not configured: EDGE_TTS_TRUSTED_CLIENT_TOKEN is missing');
  const ssml = [
    "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='my-MM'>",
    "<voice name='my-MM-ThihaNeural'>",
    `<prosody pitch='${pitchValue(pitch)}' rate='+0%'>${escapeXml(text)}</prosody>`,
    '</voice>',
    '</speak>'
  ].join('');
  const response = await fetch(`${EDGE_TTS_URL}?TrustedClientToken=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'RECAST/1.0'
    },
    body: ssml
  });
  const contentType = response.headers.get('content-type') || '';
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`TTS provider returned HTTP ${response.status}`);
  if (!contentType.includes('audio') || !looksLikeAudio(bytes)) throw new Error('TTS provider returned an invalid audio response');
  return bytes;
}

async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  let input;
  try {
    input = await readInput(req);
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid request' });
  }
  const text = sanitizeText(input.text || 'မင်္ဂလာပါ');
  const voice = parseVoice(input.voice);
  const pitch = parsePitch(input.pitch);
  if (!text) return json(res, 400, { error: 'Text is required after sanitization' });
  if (text.length > MAX_TEXT_LENGTH) return json(res, 400, { error: `Text must be ${MAX_TEXT_LENGTH} characters or fewer` });
  if (!voice) return json(res, 400, { error: 'Unknown voice', supportedVoices: Object.keys(VOICES) });
  if (pitch === null) return json(res, 400, { error: 'Pitch must be an integer from -20 to 20' });
  const config = VOICES[voice];
  if (!config.supported) {
    return json(res, 422, {
      error: `${voice} is not available in the current Burmese TTS engine`,
      voice,
      provider: config.provider,
      supportedVoices: Object.keys(VOICES).filter((name) => VOICES[name].supported),
      nextStep: 'Configure a provider adapter that explicitly supports this voice before enabling it in production.'
    });
  }
  try {
    const audio = await synthesizeThiha(text, pitch);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(audio.byteLength));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-TTS-Engine', config.provider);
    res.setHeader('X-TTS-Voice', voice);
    return res.end(audio);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown TTS error';
    console.error('[RECAST TTS]', detail);
    return json(res, 502, { error: 'Voice generation failed', detail, voice });
  }
}

module.exports = handler;
module.exports.RECAST_VOICES = VOICES;
