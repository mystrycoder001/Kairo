export const config = {
    api: {
        bodyParser: false, // Disabling Vercel's default parser for formidable
    },
};

import { IncomingForm } from 'formidable';
import fs from 'fs';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const form = new IncomingForm();
        form.parse(req, async (err, fields, files) => {
            if (err) return res.status(500).json({ error: 'Form parsing failed' });
            
            const audioFile = files.audio;
            if (!audioFile) return res.status(400).json({ error: 'No audio file provided' });
            
            // Note: In Vercel, the file is usually an array of files
            const file = Array.isArray(audioFile) ? audioFile[0] : audioFile;
            
            const formData = new FormData();
            const fileData = fs.readFileSync(file.filepath);
            
            // Append as blob since we need to send it to Groq
            const blob = new Blob([fileData], { type: file.mimetype });
            formData.append('file', blob, file.originalFilename || 'audio.webm');
            formData.append('model', 'whisper-large-v3');

            // Call Groq API
            const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: formData
            });

            const data = await groqRes.json();
            
            if (!groqRes.ok) {
                return res.status(groqRes.status).json({ error: data.error?.message || 'Transcription failed' });
            }

            return res.status(200).json({ text: data.text });
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
