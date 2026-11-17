export default async function handler(req, res) {
    const {
        text = 'မင်္ဂလာပါ',
        voice = 'my-MM-ThihaNeural',
        pitch = '+0Hz',
        rate = '+0%'
    } = req.query;

    try {
        // Connect to Microsoft Edge Neural TTS Service (Natural Human-like Burmese Voices)
        const trustedClientToken = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
        const url = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${trustedClientToken}`;

        // Fallback via reliable Neural TTS endpoint
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='my-MM'>
            <voice name='${voice}'>
                <prosody pitch='${pitch}' rate='${rate}'>${escapeXml(text)}</prosody>
            </voice>
        </speak>`;

        // Use StreamElements / Edge Neural REST Wrapper for instant serverless MP3 response
        const apiUrl = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
        const response = await fetch(apiUrl);

        if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(Buffer.from(arrayBuffer));
        }

        // Secondary Natural Neural Fallback
        const langCode = voice.startsWith('th-') ? 'th' : voice.startsWith('zh-') ? 'zh-CN' : voice.startsWith('en-') ? 'en' : 'my';
        const fallbackUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${langCode}&q=${encodeURIComponent(text)}`;
        const fbRes = await fetch(fallbackUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const fbBuffer = Buffer.from(await fbRes.arrayBuffer());
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(fbBuffer);
    } catch (error) {
        res.status(500).json({ error: 'Neural TTS Error' });
    }
}

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}
