const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = Number(process.env.ATLAS_TTS_HOURLY_LIMIT || 30);
const buckets = new Map();

function getIP(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString().split(',')[0].trim();
}

function rateLimited(ip) {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now - bucket.start > WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS;
}

function cleanSpeechText(input) {
  return String(input || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[>*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1800);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Atlas voice has not been connected yet.' });
  }
  if (rateLimited(getIP(req))) {
    return res.status(429).json({ error: 'Atlas voice has reached its hourly limit.' });
  }

  const text = cleanSpeechText(req.body?.text);
  if (!text) return res.status(400).json({ error: 'No speech text supplied.' });

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
        voice: process.env.OPENAI_TTS_VOICE || 'onyx',
        input: text,
        instructions: 'Speak as Atlas, a calm, cinematic British digital guide. Use a deep, warm, confident tone. Sound natural and human, never salesy or theatrical. Use measured pacing, subtle pauses after short sentences, and gentle emphasis on ClientCapture and Start Your World.',
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('OpenAI TTS error', response.status, details);
      return res.status(502).json({ error: 'Atlas voice is temporarily unavailable.' });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(audio.length));
    return res.status(200).send(audio);
  } catch (error) {
    console.error('Atlas speech server error', error);
    return res.status(500).json({ error: 'Atlas voice is temporarily offline.' });
  }
};
