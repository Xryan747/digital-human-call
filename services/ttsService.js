/**
 * Fish Audio TTS Service
 * API: https://api.fish.audio/v1/tts
 */

const FISH_AUDIO_BASE = 'https://api.fish.audio';

async function textToSpeech(text, voiceId) {
  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!apiKey) {
    throw new Error('FISH_AUDIO_API_KEY not configured');
  }

  const voice = voiceId || process.env.FISH_AUDIO_VOICE_ID || 'default';

  const response = await fetch(`${FISH_AUDIO_BASE}/v1/tts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice_id: voice,
      format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Fish Audio TTS error (${response.status}): ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { textToSpeech };
