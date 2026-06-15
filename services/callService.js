/**
 * Call Service — Real-time call pipeline
 * Orchestrates: LLM → TTS → D-ID with fallback chain
 */

const { chat } = require('./llmService');
const { textToSpeech } = require('./ttsService');
const { sendText, sendAudio } = require('./didService');

async function processUserSpeech(persona, userText, conversationHistory, didStream) {
  // 1. Add user message to history
  conversationHistory.push({ role: 'user', content: userText });

  // 2. Get LLM response
  console.log(`[Call] User said: "${userText}"`);
  const replyText = await chat(conversationHistory, persona.system_prompt);
  console.log(`[Call] AI reply: "${replyText}"`);

  // 3. Add assistant reply to history
  conversationHistory.push({ role: 'assistant', content: replyText });

  // 4. Try Fish Audio TTS → D-ID with custom audio
  let audioBuffer = null;
  let didResult = null;
  let usedFallback = false;

  if (process.env.FISH_AUDIO_API_KEY) {
    try {
      audioBuffer = await textToSpeech(replyText);
      const audioBase64 = audioBuffer.toString('base64');
      didResult = await sendAudio(didStream.id, didStream.session_id, audioBase64);
    } catch (err) {
      console.warn('[Call] Fish Audio TTS failed, falling back to D-ID internal TTS:', err.message);
      usedFallback = true;
    }
  } else {
    usedFallback = true;
  }

  // 5. Fallback: D-ID's internal Microsoft TTS
  if (!didResult && didStream) {
    try {
      didResult = await sendText(didStream.id, didStream.session_id, replyText);
    } catch (err) {
      console.error('[Call] D-ID fallback also failed:', err.message);
    }
  }

  return {
    replyText,
    audioBuffer,
    didResult,
    usedFallback,
  };
}

module.exports = { processUserSpeech };
