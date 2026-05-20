const { IncomingForm } = require('formidable');
const fs = require('fs');
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed', text: '' });
    }

    function isPlaceholderKey(key) {
        if (!key) return true;
        const k = key.trim().toLowerCase();
        return k === '' || k.includes('your_') || k.includes('placeholder') || k === 'your_groq_key';
    }

    const groqKey = process.env.GROQ_API_KEY;
    const isPlaceholder = isPlaceholderKey(groqKey);

    if (!groqKey || isPlaceholder) {
        console.error('GROQ_API_KEY is missing or placeholder in production.');
        return res.status(400).json({ error: 'Groq API Key is not configured on this server.', text: '' });
    }

    try {
        const form = new IncomingForm();

        const data = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) return reject(err);
                resolve({ fields, files });
            });
        });

        const audioFile = data.files.audio;
        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided', text: '' });
        }

        const file = Array.isArray(audioFile) ? audioFile[0] : audioFile;
        const fileData = fs.readFileSync(file.filepath);

        // Manually build multipart form-data to ensure perfect cross-runtime compatibility without global FormData or Blob
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const parts = [];

        // Append file
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${file.originalFilename || 'audio.webm'}"\r\n` +
            `Content-Type: ${file.mimetype || 'audio/webm'}\r\n\r\n`
        ));
        parts.push(fileData);

        // Append model
        parts.push(Buffer.from(
            `\r\n--${boundary}\r\n` +
            `Content-Disposition: form-data; name="model"\r\n\r\n` +
            `whisper-large-v3`
        ));

        // Close boundary
        parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

        const bodyBuffer = Buffer.concat(parts);

        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: bodyBuffer
        });

        const groqData = await groqRes.json();

        if (!groqRes.ok) {
            console.error('Groq API Transcription call failed:', groqData);
            return res.status(groqRes.status).json({ 
                error: groqData.error?.message || 'Groq Transcription failed', 
                text: '' 
            });
        }

        return res.status(200).json({ text: groqData.text });

    } catch (e) {
        console.error('Internal Server Error in transcription:', e);
        return res.status(500).json({ error: 'Internal Server Error during transcription', text: '' });
    }
};

module.exports.config = {
    api: {
        bodyParser: false,
    },
};
