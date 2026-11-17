export default async function handler(req, res) {
    const {
        text = 'မင်္ဂလာပါ',
        voice = 'Puck',
        pitch = '0'
    } = req.query;

    const apiKey = process.env.GEMINI_API_KEY;
    const pitchVal = parseInt(pitch) || 0;
    const toneInstruction = pitchVal < -15
        ? 'Speak in a deep, warm, cinematic male narrator tone.'
        : pitchVal > 15
        ? 'Speak in a bright, expressive, youthful tone.'
        : 'Speak naturally like a professional Burmese movie recap storyteller.';

    // 1. Try Gemini Native TTS first (Single Request for full script)
    if (apiKey) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `${toneInstruction} Pause briefly at each sentence break. Read aloud clearly and naturally: "${text}"`
                        }]
                    }],
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: voice }
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
                res.setHeader('X-TTS-Engine', 'Gemini-Native');
                return res.status(200).send(wavBuffer);
            }
        } catch (e) {
            // Fall through to backup engine if quota exceeded
        }
    }

    // 2. Automatic Backup Burmese TTS when Gemini Free Tier 10/day quota is reached
    try {
        const chunks = splitTextChunks(text, 180);
        const mp3Buffers = [];

        for (const chunk of chunks) {
            const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=my&q=${encodeURIComponent(chunk)}`;
            const ttsRes = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (ttsRes.ok) {
                mp3Buffers.push(Buffer.from(await ttsRes.arrayBuffer()));
            }
        }

        if (mp3Buffers.length > 0) {
            const combined = Buffer.concat(mp3Buffers);
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('X-TTS-Engine', 'Backup-MM');
            return res.status(200).send(combined);
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

    return res.status(500).json({ error: 'TTS generation failed' });
}

function splitTextChunks(str, maxLen) {
    const parts = str.split(/(?<=[။\.!?])\s*/);
    const chunks = [];
    let current = '';
    for (const p of parts) {
        if ((current + ' ' + p).length > maxLen) {
            if (current) chunks.push(current.trim());
            current = p;
        } else {
            current = current ? (current + ' ' + p) : p;
        }
    }
    if (current) chunks.push(current.trim());
    return chunks.length ? chunks : [str.slice(0, maxLen)];
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
