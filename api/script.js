export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(400).json({ error: 'Vercel တွင် GEMINI_API_KEY မထည့်ရသေးပါ။' });
    }

    const { sourceInfo = '', platform = 'tiktok', lang = 'Myanmar' } = req.body;

    const lengthGuide = platform === 'tiktok'
        ? 'Keep it concise (around 120-160 words) for a 1-minute viral TikTok/Shorts recap.'
        : 'Keep it well-paced (around 250-350 words) for a YouTube movie recap.';

    const prompt = `Write an engaging, natural storytelling movie recap script in ${lang} for: "${sourceInfo}".
${lengthGuide}
Format strictly as:
🔥 [HOOK]: (1-2 punchy sentences)
🎬 [STORY]: (Natural storytelling narration ready for voiceover)
⚡ [CLIFFHANGER]: (1 exciting closing line)`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    thinkingConfig: { thinkingBudget: 0 },
                    maxOutputTokens: 800,
                    temperature: 0.7
                }
            })
        });

        const data = await response.json();
        const script = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!script) {
            return res.status(500).json({ error: data?.error?.message || 'Script generation failed' });
        }

        return res.status(200).json({ script });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
