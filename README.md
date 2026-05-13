# Kairo — One Voice. All AIs.

A voice-to-prompt AI app that converts rough voice/text into perfect AI prompts and saves user context across every AI tool forever.

## Features
- **Prompt Builder:** Turn messy speech or text into highly structured AI prompts.
- **AI Passport:** Save your identity and context once, use it everywhere.
- **Session Sync:** Paste a previous conversation to summarize the context and resume in another tool instantly.
- **AI Waterfall:** Seamless backend switching between Gemini, Groq, and OpenRouter if an API limit is reached.
- **PWA:** Installable as a native-feeling app on mobile and desktop.

## Deployment
This app is designed to be deployed on Vercel.

1. Clone the repository.
2. Link to a Vercel project: `vercel link`
3. Add environment variables in Vercel settings (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`).
4. Deploy: `vercel --prod`

## Tech Stack
- Frontend: Vanilla HTML, CSS, JavaScript
- Backend: Vercel Serverless Functions (Node.js)
- APIs: Web Speech API, Gemini (primary), Groq (fallback), OpenRouter (fallback).
