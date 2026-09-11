# CivicShield — Civic Hazard Reporting & Legal Petition Generator

<p align="center">
  <img src="frontend/public/favicon.svg" width="80" alt="CivicShield Logo" />
</p>

<p align="center">
  <strong>THE BRIDGE TO MUNICIPAL ACTION</strong>
</p>

<p align="center">
  <a href="https://gemini-webapp-civicshield.vercel.app">🌐 Live Demo</a> •
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#security">Security</a>
</p>

---

## Overview

**CivicShield** is an AI-powered Progressive Web App (PWA) that empowers Indian citizens to report civic hazards (potholes, broken streetlamps, open manholes, etc.) and automatically generates legally-grounded formal petitions and RTI queries addressed to the correct municipal authority.

## Features

- 📸 **Upload or live-capture** a photo of a civic hazard
- 🤖 **AI Analysis** using Google Gemini — detects hazard type, severity score (1-10), and responsible authority
- 📄 **Auto-generates formal petitions** citing Indian constitutional rights (Article 21, etc.)
- 📬 **Gmail integration** — opens a pre-filled draft with the petition and evidence link
- 📋 **RTI question generator** for filing Right to Information requests
- 🎤 **Multilingual voice dictation** — supports English, Hindi, Kannada, Tamil, Telugu, Marathi
- 🌐 **Language selector** — petitions generated in user's regional language
- 👤 **Persistent user profile** — name, email, phone, address auto-filled in every petition
- 📍 **GPS-based reverse geocoding** for accurate ward/pincode in the petition
- 📱 **PWA with offline support** — reports queued locally and synced on reconnect
- 🗂️ **History view** — browse all past reports stored in IndexedDB
- 🗺️ **Nearby hazards** — see civic issues reported by others in the area
- 🌙 **Dark mode** — full dark/light theme toggle

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, Lucide Icons |
| Offline | Progressive Web App (Workbox), IndexedDB (idb) |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| AI | Google Gemini API (`gemini-3.5-flash`) |
| Geocoding | Google Maps Geocoding API |
| Deployment | Vercel |
| Testing | Pytest, FastAPI TestClient |

## Security

CivicShield implements multiple layers of security:

- 🛡️ **Security Headers**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- 🚦 **Rate Limiting**: Maximum 10 API requests per IP per minute
- ✅ **Input Validation**: File type whitelist, 10 MB size limit, coordinate range checks, extension validation
- 🧹 **Prompt Injection Prevention**: All user text inputs sanitized (control chars stripped, length capped)
- 🔒 **Configurable CORS**: Restricted to allowed origins via environment variable

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Google Gemini API Key](https://makersuite.google.com/app/apikey)

### Backend Setup
```bash
cd backend
python -m venv venv
# Windows: .\venv\Scripts\python.exe -m pip install -r requirements.txt
# Mac/Linux: source venv/bin/activate && pip install -r requirements.txt
pip install -r requirements.txt

# Start the server
GEMINI_API_KEY=your_key_here uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run build   # Production build served by FastAPI
# OR
npm run dev     # Standalone dev server on port 5173
```

### Running Tests
```bash
pip install pytest httpx
pytest
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Google Gemini API Key |
| `GOOGLE_MAPS_API_KEY` | ⚠️ Optional | For accurate reverse geocoding |
| `ALLOWED_ORIGINS` | ⚠️ Optional | Comma-separated CORS origins (default: `*`) |

## Deployment (Vercel)

1. Import `gemini-webapp-civicshield` from GitHub in [Vercel Dashboard](https://vercel.com/new)
2. Add `GEMINI_API_KEY` in Environment Variables
3. Deploy — Vercel auto-detects `vercel.json`

## License

MIT License — built with ❤️ for civic empowerment.
