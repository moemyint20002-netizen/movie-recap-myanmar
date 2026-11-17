export default async function handler(req, res) {
    const {
        text = 'မင်္ဂလာပါ',
        voiceName = 'Puck',
        style = 'natural storytelling'
    } = req.query;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(400).json({ error: 'Vercel တွင် GEMINI_API_KEY မထည့်ရသေးပါ။' });
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Read the following Burmese/text aloud naturally as a professional movie recap narrator (${style} tone). Output ONLY the spoken audio without adding any extra words:\n\n${text}`
                    }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voiceName
                            }
                        }
                    }
                }
            })
        });

        const data = await response.json();
        const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

        if (!inlineData || !inlineData.data) {
            return res.status(500).json({ error: 'Gemini Audio generation failed', details: data });
        }

        const pcmBuffer = Buffer.from(inlineData.data, 'base64');
        const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);

        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(wavBuffer);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

function pcmToWav(pcmData, sampleRate, numChannels, bitsPerSample) {
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmData.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
}
