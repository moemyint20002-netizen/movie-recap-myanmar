# RECAST — Cinematic Burmese Movie Recap Studio

RECAST is a browser-first movie recap studio for chronological source analysis, Burmese screenplay editing, hook selection, provider-verified voice previews, subtitles, blur masks, audio-layer planning, QC and final video export.

## Server configuration

Copy `.env.example` into your deployment settings. Set `GEMINI_API_KEY` for screenplay analysis and `EDGE_TTS_TRUSTED_CLIENT_TOKEN` for the currently supported Burmese Thiha provider voice. Credentials are read only by server-side handlers and are never hardcoded or shipped to the browser. `GEMINI_MODEL` is optional.

The UI intentionally displays the requested studio catalog voices (Thiha, Puck, Charon, Fenrir, Aoede, Kore and Leda), but `/api/tts` only accepts a voice when the current provider explicitly supports it. Unsupported names return a clear `422` response; they are never silently remapped.

## Checks

```bash
npm run typecheck
npm run build
```

Vercel serves `index.html` as the static frontend and the files in `api/` as Node serverless functions. The browser render uses MediaRecorder and exports MP4 when the browser supports it, otherwise it returns a WebM fallback with a truthful extension.
