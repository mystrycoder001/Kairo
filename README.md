# Mindwave — One Mind. All AIs.

Mindwave is an intelligent architectural AI prompting system that turns your thoughts and session history into perfect, reusable context blocks. It bridges the gap between different AI tools while maintaining a persistent digital identity.

## Key Features
- **Voice-to-Prompt**: High-precision architectural instruction generation from speech.
- **AI Identity Seed**: Define your role, goals, and style once—attach it to every prompt.
- **Session Sync**: Bridge context between ChatGPT, Claude, and Gemini seamlessly.
- **14-Day Pro Trial**: Full access to all features for 14 days, with proactive usage monitoring.

## Tech Stack
- **Frontend**: Vanilla JS, TailwindCSS, Stitch Design System ("Intelligent Void").
- **Backend**: Vercel Serverless Functions (Node.js).
- **AI Pipeline**: Gemini 1.5 Flash -> Groq (Llama 3) -> OpenRouter.
- **Auth**: Supabase (Google OAuth & Magic Links).

## Environment Variables
Create a `.env` file with the following:
```env
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
OPENROUTER_API_KEY=your_key
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
```

## Getting Started
1. Install dependencies: `npm install`
2. Run locally: `npx serve .` (or use VS Code Live Server)
3. Deploy: `vercel`

## Branding
Mindwave uses a high-contrast, black-and-white "Intelligent Void" aesthetic for maximum focus and architectural precision.
