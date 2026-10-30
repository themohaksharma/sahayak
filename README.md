# Sahayak

Sahayak is a voice-first assistant that helps people explore government schemes through a short, accessible conversation. It currently supports Hindi, English, and Punjabi. Its eligibility screening is preliminary and never claims government approval.

## Features

- Responsive React interface for desktop and mobile.
- Microphone speech recognition through Chariot, with automatic finalization after silence and a typed fallback.
- Spoken assistant prompts and result summaries, with readable text and replay controls.
- Hindi, English, and Punjabi interface and speech input.
- Up to six simple farming questions.
- Deterministic Python eligibility rules over a curated JSON dataset containing PM-KISAN, Kisan Credit Card, and PMFBY.
- Results explain potential eligibility, reasons, remaining conditions, required documents, and official government links.
- WhatsApp and SMS sharing based on actual assessment results; the user reviews and sends the message.
- The Chariot API key stays in the backend environment and is never sent to frontend code.

## Technologies

- Frontend: React, Vite, Tailwind CSS, Web Audio APIs.
- Backend: Python, FastAPI.
- Scheme data: structured JSON and deterministic Python rules.
- Speech: Chariot ASR and TTS, called by the backend.

## Requirements

- Node.js 22.12 or newer.
- Python 3.10 or newer.
- A Chariot API key for speech features. Typed answers remain available if speech is unavailable.

## Install and run

### Start the backend

From the project root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and set `CHARIOT_API_KEY` to your key. Keep this file private; `.gitignore` excludes it. Then start FastAPI:

```bash
uvicorn app.main:app --reload --port 8000
```

Health check: <http://localhost:8000/api/health>. API documentation: <http://localhost:8000/docs>.

### Start the frontend

In another terminal, from the project root:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:5173>. If the backend runs at a different address, update `VITE_API_BASE_URL` in `frontend/.env.local`.

## Deployment

The Vite build uses relative asset paths for GitHub Pages project URLs. Deployment configurations are included:

- `.github/workflows/deploy-pages.yml` builds and deploys the frontend on pushes to `main`.
- `render.yaml` describes a FastAPI web service. Add `CHARIOT_API_KEY` as a private Render environment variable after the service is created; never place the key in this repository.

To publish the live app:

1. Create a Blueprint from this public repository in Render using `render.yaml` and wait for the service to become live.
2. In the Render service's **Environment** settings, add `CHARIOT_API_KEY` as a secret. Until then, API health and scheme data work, but Chariot speech endpoints remain unavailable.
3. The GitHub Actions Pages workflow builds the frontend with `VITE_API_BASE_URL` and deploys it automatically when `main` changes. The repository variable must contain the HTTPS URL assigned to the Render backend.
4. In GitHub repository settings under Pages, choose **GitHub Actions** as the build and deployment source. The free Render plan may spin down after inactivity, so its first request can be delayed.

The backend CORS origin is set in `render.yaml` to `https://themohaksharma.github.io`. Do not use `localhost` in a public frontend build. Microphone access requires HTTPS and user permission.

## Privacy and limitations

Sahayak does not store answers in its own database. It sends the structured assessment answers to the backend for a one-time screening. Speech is sent to Chariot through the backend for transcription or speech generation; review Chariot's current data-handling terms before using the service. Do not enter Aadhaar numbers, bank details, phone numbers, or unnecessary personal information. Scheme data is intentionally limited and links to official sources. Final eligibility must be confirmed with the responsible government department or bank.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
