# 🌊 Cloasta — Your Personal AI Memory Layer

Cloasta is an intelligent architectural AI system that transforms rough thoughts, voice notes, and session histories into high-precision context blocks. It bridges the gap between major AI tools (ChatGPT, Claude, Gemini) while maintaining a persistent digital identity (AI Passport).

## 🚀 Key Features
- **🎙️ Voice-to-Prompt**: High-precision architectural instruction generation from speech with 3-tier fallback.
- **🪪 AI Passport**: Define your role, goals, and style once—automatically attached to every generated prompt.
- **🔄 Session Sync**: Dense context extraction to bridge conversations across different AI platforms seamlessly.
- **⏳ Account-Linked Trial**: Secure 14-day Pro trial managed via Supabase, persisting across all your devices.
- **⚡ AI Waterfall**: Robust processing pipeline using Gemini 1.5 Flash -> Groq (Llama 3) -> OpenRouter.

## 🛠️ Tech Stack
- **Frontend**: Vanilla JS, TailwindCSS, Stitch Design System ("Intelligent Void").
- **Auth & Database**: [Supabase](https://supabase.com/) (Google OAuth, RLS, PostgreSQL).
- **Backend**: Vercel Serverless Functions (Node.js).
- **PWA**: Fully installable Progressive Web App.

## 🔑 Environment Variables
The application requires the following variables in Vercel or your `.env` file:
```env
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

## 📦 Getting Started
1. **Clone & Install**: `git clone` then `npm install`.
2. **Database Setup**: Run the SQL schema provided in the conversation history in your Supabase SQL Editor.
3. **Local Dev**: `npx serve .` or use the Vercel CLI.
4. **Deploy**: `vercel --prod`.

## 🎨 Design Philosophy
Cloasta utilizes a high-contrast **"Intelligent Void"** aesthetic—a minimalist black-and-white system designed for maximum focus, architectural precision, and a premium feel.

---
*Built for architects of the future.*
