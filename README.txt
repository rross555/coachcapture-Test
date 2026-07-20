CLIENTCAPTURE WORLDS + ASK ATLAS

Deploy the complete folder to Vercel.

Required Vercel environment variable:
OPENAI_API_KEY = your OpenAI API key

Optional environment variables:
OPENAI_MODEL = gpt-5-mini
ATLAS_HOURLY_LIMIT = 20

After adding the environment variable, redeploy the project.

Ask Atlas includes:
- Live OpenAI Responses API integration through /api/atlas
- No API key exposed in index.html
- Text questions and browser speech recognition
- Spoken replies using the visitor's installed browser voices
- Short conversation memory
- Per-connection hourly rate limiting
- Direct Start Your World routing to:
  https://www.getclientcapture.co.uk/enquiry.html

The fixed cinematic narration and generative ambient music remain browser-based and require no external audio licence.

ATLAS PREMIUM VOICE
-------------------
Atlas replies now use the secure Vercel endpoint /api/speech and OpenAI text-to-speech.
The same OPENAI_API_KEY powers both chat and voice.

Optional Vercel Environment Variables:
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=onyx
ATLAS_TTS_HOURLY_LIMIT=30

The site falls back to the device voice only if premium speech generation fails.
After uploading these files, redeploy the Vercel project so api/speech.js is created.
