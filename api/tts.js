export default async function handler(req, res) {
    const {
        text = 'မင်္ဂလာပါ',
        voice = 'Thiha',
        pitch = '0'
    } = req.query;

    // 1. Try Microsoft Edge Neural TTS First for Thiha & Nilar
    if (voice === 'Thiha' || voice === 'Nilar') {
        try {
            const voiceId = voice === 'Thiha' ? 'my-MM-ThihaNeural' : 'my-MM-NilarNeural';
            const audioBuffer = await synthesizeEdgeNeural(text, voiceId, pitch);
            if (audioBuffer && audioBuffer.length > 500) {
                res.setHeader('Content-Type', 'audio/mpeg');
                res.setHeader('X-TTS-Engine', `${voice}-Neural`);
                return res.status(200).send(audioBuffer);
            }
        } catch (e) {
            // Fall through to Gemini Native Audio
        }
    }

    // 2. Try Gemini Native Voices with multiple model fallbacks (Bypasses High Demand limits)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(400).json({ error: 'GEMINI_API_KEY မရှိပါ' });
    }

    const geminiVoice = (voice === 'Thiha') ? 'Charon' : (voice === 'Nilar') ? 'Aoede' : voice;
    const models = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-2.5-flash-preview-tts'];
    let lastError = 'Audio generation failed';

    for (const model of models) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Read aloud clearly and naturally without extra commentary: "${text}"`
                        }]
                    }],
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: geminiVoice }
                            }
                        }
                    }
                })
            });

            const data = await response.json();
            const parts = data?.candidates?.[0]?.content?.parts || [];
            const audioPart = parts.find(p => p.inlineData && p.inlineData.data);

            if (audioPart && audioPart.inlineData.data) {
                const rawBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
                const wavBuffer = pcmToWav(rawBuffer, 24000, 1, 16);
                res.setHeader('Content-Type', 'audio/wav');
                res.setHeader('X-TTS-Engine', `Gemini-${geminiVoice}`);
                return res.status(200).send(wavBuffer);
            }
            lastError = data?.error?.message || lastError;
        } catch (err) {
            lastError = err.message;
        }
    }

    // 3. Ultimate Fallback to Google Translate TTS if Gemini is busy
    try {
        const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=my&q=${encodeURIComponent(text.slice(0, 200))}`;
        const ttsRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (ttsRes.ok) {
            const buf = Buffer.from(await ttsRes.arrayBuffer());
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('X-TTS-Engine', 'Fallback-GTX');
            return res.status(200).send(buf);
        }
    } catch (err) {}

    return res.status(500).json({ error: lastError });
}

async function synthesizeEdgeNeural(text, voiceName, pitch) {
    const pitchHz = `${parseInt(pitch) || 0}Hz`;
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='my-MM'>
        <voice name='${voiceName}'>
            <prosody pitch='${pitchHz}' rate='+0%'>${escapeXml(text)}</prosody>
        </voice>
    </speak>`;

    const response = await fetch('https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'
        },
        body: ssml
    });

    if (!response.ok) throw new Error(`Edge TTS HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
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

function pcmToWav(pcmData, sampleRate, numChannels, bitsPerSample) {
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmData.length;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    pcmData.copy(buffer, 44);

    return buffer;
}
