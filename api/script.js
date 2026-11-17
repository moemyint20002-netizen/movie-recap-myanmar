export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(400).json({ error: 'Vercel တွင် GEMINI_API_KEY မထည့်ရသေးပါ။' });
    }

    const {
        sourceInfo = '',
        durationSec = 60,
        frames = [],
        lang = 'Myanmar'
    } = req.body;

    // Exact Burmese word target matched to video duration (avoids early cutoff or repetition)
    const targetWords = Math.max(40, Math.round(durationSec * 2.4));
    const sceneCount = Math.max(4, Math.min(24, Math.round(durationSec / 7)));

    const prompt = `You are an expert Burmese Movie Recap narrator and video analyst.
Analyze the attached chronological video frames (captured evenly from start to end of the ${Math.round(durationSec)}-second video) and the title/context: "${sourceInfo}".

STRICT RULES:
1. Write a cohesive, natural, engaging ${lang} narration script that strictly matches the visual progression of the scenes from start to finish.
2. Total script length MUST be approximately ${targetWords} words (around ${sceneCount} concise sentences) so the voiceover fills the ${Math.round(durationSec)}-second video smoothly without ending early or repeating/dragging.
3. DO NOT repeat phrases, DO NOT pad with filler words, and DO NOT include labels like [HOOK], [STORY], or [CLIFFHANGER].
4. Output ONLY the clean spoken Burmese sentences, one sentence per line, ready for voiceover and subtitle burning.`;

    const parts = [{ text: prompt }];
    if (Array.isArray(frames)) {
        for (const base64Img of frames.slice(0, 6)) {
            if (base64Img && base64Img.includes(',')) {
                const [meta, data] = base64Img.split(',');
                const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
                parts.push({ inlineData: { mimeType, data } });
            }
        }
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                    thinkingConfig: { thinkingBudget: 0 },
                    maxOutputTokens: 1500,
                    temperature: 0.65
                }
            })
        });

        const data = await response.json();
        const script = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!script) {
            return res.status(500).json({ error: data?.error?.message || 'Script generation failed' });
        }

        return res.status(200).json({ script: script.trim() });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
