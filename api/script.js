const MAX_FRAMES = 6;
const MAX_FRAME_CHARS = 900000;

function cleanString(value, max = 240) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/gu, '').trim().slice(0, max) : '';
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return body;
}

function parseModelJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw); } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
    }
    return null;
  }
}

function fallbackScenes(script, durationSec) {
  return String(script || '').split(/[\n။.!?]+/).map((text) => text.trim()).filter((text) => text.length > 5).slice(0, 24).map((narration, index, list) => ({
    index: index + 1,
    title: `Scene ${String(index + 1).padStart(2, '0')}`,
    visual: 'Chronological narration beat',
    narration,
    start: Math.round((index / Math.max(1, list.length)) * durationSec)
  }));
}

function normalizeResult(modelText, durationSec) {
  const parsed = parseModelJson(modelText);
  const script = cleanString(parsed?.script || modelText, 24000);
  const hookOptions = Array.isArray(parsed?.hookOptions) ? parsed.hookOptions.map((v) => cleanString(v, 100)).filter(Boolean).slice(0, 3) : [];
  const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes.slice(0, 24).map((scene, index) => ({
    index: index + 1,
    title: cleanString(scene?.title || `Scene ${String(index + 1).padStart(2, '0')}`, 100),
    visual: cleanString(scene?.visual || 'Chronological scene beat', 240),
    narration: cleanString(scene?.narration || '', 1000),
    start: Number.isFinite(Number(scene?.start)) ? Number(scene.start) : Math.round((index / Math.max(1, parsed.scenes.length)) * durationSec)
  })).filter((scene) => scene.narration) : fallbackScenes(script, durationSec);
  return {
    script,
    hookOptions: hookOptions.length ? hookOptions : ['The impossible detail', 'A warning too late', 'The hidden motive'],
    recommendedHook: Number.isInteger(parsed?.recommendedHook) ? Math.max(0, Math.min(2, parsed.recommendedHook)) : 0,
    scenes
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server' });
  const body = parseBody(req.body);
  const sourceInfo = cleanString(body.sourceInfo || 'Untitled film', 240) || 'Untitled film';
  const durationSec = Math.max(5, Math.min(7200, Number(body.durationSec) || 60));
  const lang = cleanString(body.lang || 'Myanmar', 40) || 'Myanmar';
  const brief = cleanString(body.brief || '', 300);
  const frames = Array.isArray(body.frames) ? body.frames.filter((frame) => typeof frame === 'string' && frame.includes(',') && frame.length <= MAX_FRAME_CHARS).slice(0, MAX_FRAMES) : [];
  const targetWords = Math.max(40, Math.round(durationSec * 2.4));
  const sceneCount = Math.max(4, Math.min(24, Math.round(durationSec / 7)));
  const prompt = `You are an expert Burmese movie recap director and chronological video analyst.\nAnalyze the supplied frames in chronological order for a ${Math.round(durationSec)}-second source video. Context: "${sourceInfo}". Director brief: "${brief || 'cinematic, clear, suspenseful, spoiler-aware'}".\nReturn ONLY valid JSON with this exact shape: {"hookOptions":["...","...","..."],"recommendedHook":0,"scenes":[{"title":"...","visual":"...","narration":"...","start":0}],"script":"..."}.\nRules: write natural spoken Burmese in narration and script; keep ${sceneCount} chronological scene beats; total script about ${targetWords} words; hookOptions must be short opening lines in Burmese or concise English labels; never use labels such as [HOOK] in spoken script; no markdown; do not invent visual events that contradict the frames; the script must be ready for subtitles and voiceover.`;
  const parts = [{ text: prompt }];
  for (const frame of frames) {
    const [meta, data] = frame.split(',', 2);
    const mimeType = meta.match(/^data:([^;]+);base64$/i)?.[1] || 'image/jpeg';
    if (data) parts.push({ inlineData: { mimeType, data } });
  }
  try {
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 3000, temperature: 0.65 } })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ error: data?.error?.message || `Gemini returned HTTP ${response.status}` });
    const modelText = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!modelText) return res.status(502).json({ error: 'Gemini returned no screenplay content' });
    return res.status(200).json(normalizeResult(modelText, durationSec));
  } catch (error) {
    console.error('[RECAST SCRIPT]', error);
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Script generation failed' });
  }
};
