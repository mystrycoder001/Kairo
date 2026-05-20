require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enforce CORS for local dev
app.use(cors());

// Parse JSON body for all routes EXCEPT the transcription API
// (which requires a raw body stream for Formidable parsing)
app.use((req, res, next) => {
    if (req.path === '/api/transcribe') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

// Dynamic Vercel Serverless Function Router for /api/*
app.all('/api/:functionName', async (req, res) => {
    const { functionName } = req.params;
    const apiFilePath = path.join(__dirname, 'api', `${functionName}.js`);

    if (!fs.existsSync(apiFilePath)) {
        console.error(`[Serverless router] 404: Endpoint /api/${functionName} not found`);
        return res.status(404).json({ error: 'Endpoint not found' });
    }

    try {
        console.log(`[Serverless router] Calling /api/${functionName} (${req.method})`);
        
        // Clear require cache for easy hot-reloading during local dev
        delete require.cache[require.resolve(apiFilePath)];
        const handler = require(apiFilePath);

        // Execute the serverless handler
        await handler(req, res);
    } catch (err) {
        console.error(`[Serverless router] Error in /api/${functionName}:`, err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
    }
});

// Serve Static Frontend Files
app.use(express.static(__dirname));

// Single Page Application & file fallback routing
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, req.path);
    
    // Check if the requested file exists, otherwise fallback to dashboard or 404
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return res.sendFile(filePath);
    }
    
    // Default fallback to 404 page if not found
    const path404 = path.join(__dirname, '404.html');
    if (fs.existsSync(path404)) {
        res.status(404).sendFile(path404);
    } else {
        res.status(404).send('Not Found');
    }
});

app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 CLOASTA FULL-STACK DEV SERVER ONLINE!`);
    console.log(`📡 Local Staging: http://localhost:${PORT}`);
    console.log(`==================================================\n`);
});
