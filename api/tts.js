import WebSocket from 'ws';
import crypto from 'crypto';

export default async function handler(req, res) {
    const {
        text = 'မင်္ဂလာပါ',
        voice = 'my-MM-ThihaNeural',
        pitch = '+0Hz',
        rate = '+0%'
    } = req.query;

    try {
        const audioBuffer = await synthesizeEdgeTTS(text, voice, pitch, rate);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(audioBuffer);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

function synthesizeEdgeTTS(text, voice, pitch, rate) {
    return new Promise((resolve, reject) => {
        const trustedClientToken = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
        const reqId = crypto.randomUUID().replace(/-/g, '');
        const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${trustedClientToken}&ConnectionId=${reqId}`;

        const ws = new WebSocket(url, {
            headers: {
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
                'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'
            }
        });

        const chunks = [];
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('TTS timeout'));
        }, 12000);

        ws.on('open', () => {
            const configMsg = `X-Timestamp:${new Date().toISOString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
            ws.send(configMsg);

            const cleanText = text.replace(/[<>&'"]/g, '');
            const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='my-MM'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}'>${cleanText}</prosody></voice></speak>`;
            const ssmlMsg = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n${ssml}`;
            ws.send(ssmlMsg);
        });

        ws.on('message', (data, isBinary) => {
            if (isBinary) {
                const separator = 'Path:audio\r\n';
                const idx = data.indexOf(separator);
                if (idx !== -1) {
                    chunks.push(data.subarray(idx + separator.length));
                }
            } else {
                const msg = data.toString();
                if (msg.includes('Path:turn.end')) {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(Buffer.concat(chunks));
                }
            }
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}
