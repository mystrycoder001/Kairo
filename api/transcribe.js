const { IncomingForm } = require('formidable');
const fs = require('fs');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed', text: '' });
    }

    if (!process.env.GROQ_API_KEY) {
        console.error('GROQ_API_KEY is missing');
        return res.status(500).json({ error: 'Transcription service unavailable', text: '' });
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
        const formData = new FormData();
        const fileData = fs.readFileSync(file.filepath);

        const blob = new Blob([fileData], { type: file.mimetype || 'audio/webm' });
        formData.append('file', blob, file.originalFilename || 'audio.webm');
        formData.append('model', 'whisper-large-v3');

        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: formData
        });

        const groqData = await groqRes.json();

        if (!groqRes.ok) {
            console.error('Groq API Error:', groqData);
            return res.status(500).json({ error: 'Transcription failed', text: '' });
        }

        return res.status(200).json({ text: groqData.text });

    } catch (e) {
        console.error('Internal Server Error:', e);
        return res.status(500).json({ error: 'Transcription failed', text: '' });
    }
};

module.exports.config = {
    api: {
        bodyParser: false,
    },
};
