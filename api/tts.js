export default async function handler(req, res) {
    const {
        text = 'မင်္ဂလာပါ',
        voice = 'Puck',
        pitch = '0'
    } = req.query;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(400).json({ error: 'Vercel တွင် GEMINI_API_KEY မထည့်ရသေးပါ။' });
    }

    const pitchVal = parseInt(pitch) || 0;
    const toneInstruction = pitchVal < -15
        ? 'Speak in a deep, warm, cinematic male narrator tone.'
        : pitchVal > 15
        ? 'Speak in a bright, expressive, youthful tone.'
        : 'Speak naturally like a professional Burmese movie recap storyteller.';

    // Try supported Gemini Native Audio models in order
    const models = [
        'gemini-2.5-flash-preview-tts',
        'gemini-2.5-flash',
        'gemini-2.0-flash'
    ];

    let lastError = null;

    for (const model of models) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `${toneInstruction} Read aloud the following text clearly and naturally without adding extra commentary: "${text}"`
                        }]
                    }],
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: voice
                                }
                            }
                        }
                    }
                })
            });

            const data = await response.json();
            const parts = data?.candidates?.[0]?.content?.parts || [];
            const audioPart = parts.find(p => p.inlineData && p.inlineData.data);

            if (audioPart && audioPart.inlineData.data) {
                const mimeType = audioPart.inlineData.mimeType || 'audio/pcm';
                const rawBuffer = Buffer.from(audioPart.inlineData.data, 'base64');

                if (mimeType.includes('wav') || mimeType.includes('mp3') || mimeType.includes('mpeg')) {
                    res.setHeader('Content-Type', mimeType);
                    res.setHeader('Cache-Control', 'public, max-age=86400');
                    return res.status(200).send(rawBuffer);
                }

                // Convert raw 24kHz 16-bit PCM to playable WAV
                const wavBuffer = pcmToWav(rawBuffer, 24000, 1, 16);
                res.setHeader('Content-Type', 'audio/wav');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return res.status(200).send(wavBuffer);
            }

            lastError = data?.error?.message || JSON.stringify(data);
        } catch (err) {
            lastError = err.message;
        }
    }

    return res.status(500).json({ error: `Gemini Audio Error: ${lastError}` });
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
