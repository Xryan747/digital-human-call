/**
 * WebSocket Call Handler
 * Per-connection call state machine
 */

const { v4: uuidv4 } = require('uuid');
const { getPersona } = require('../db/database');
const { insertCallHistory, updateCallEnd } = require('../db/database');
const { createStream, sendSDPAnswer, sendICECandidate, closeStream } = require('../services/didService');
const { processUserSpeech } = require('../services/callService');

// Per-connection state
const sessions = new Map();

function setupCallHandler(wss) {
  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');

    const session = {
      personaId: null,
      persona: null,
      conversationHistory: [],
      didStream: null,
      callId: null,
      isActive: false,
    };
    sessions.set(ws, session);

    ws.on('message', async (message) => {
      let parsed;
      try {
        parsed = JSON.parse(message.toString());
      } catch {
        return;
      }

      try {
        await handleMessage(ws, session, parsed);
      } catch (err) {
        console.error('[WS] Message handler error:', err.message);
        safeSend(ws, { type: 'error', message: err.message });
      }
    });

    ws.on('close', async () => {
      console.log('[WS] Client disconnected');
      await cleanupSession(ws, session);
      sessions.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
    });
  });
}

async function handleMessage(ws, session, msg) {
  switch (msg.type) {
    case 'start_call': {
      const { personaId } = msg;
      if (!personaId) {
        return safeSend(ws, { type: 'error', message: 'Missing personaId' });
      }

      // Load persona
      const persona = getPersona(personaId);
      if (!persona) {
        return safeSend(ws, { type: 'error', message: '数字人不存在' });
      }

      session.personaId = personaId;
      session.persona = persona;
      session.conversationHistory = [];
      session.callId = uuidv4();
      session.isActive = true;

      console.log(`[WS] Starting call for persona: ${persona.name}`);

      // Record call start
      insertCallHistory({
        id: session.callId,
        persona_id: personaId,
        transcript: [],
      });

      // Create D-ID stream
      let streamData = null;
      if (process.env.DID_API_KEY && persona.photo_url) {
        try {
          // Build absolute URL for the photo
          const photoUrl = persona.photo_url.startsWith('http')
            ? persona.photo_url
            : `http://localhost:${process.env.PORT || 3000}${persona.photo_url}`;

          const stream = await createStream(photoUrl);
          session.didStream = { id: stream.id, session_id: stream.session_id };
          streamData = {
            streamId: stream.id,
            sessionId: stream.session_id,
            offer: stream.offer,
            iceServers: stream.ice_servers,
          };
        } catch (err) {
          console.error('[WS] D-ID stream creation failed:', err.message);
          // Continue without D-ID — will use photo + TTS only
        }
      }

      safeSend(ws, {
        type: 'call_connected',
        data: {
          persona: {
            id: persona.id,
            name: persona.name,
            photoUrl: persona.photo_url,
            profile: persona.profile,
          },
          streamData,
          callId: session.callId,
        },
      });
      break;
    }

    case 'user_speech': {
      if (!session.isActive) {
        return safeSend(ws, { type: 'error', message: 'Call not active' });
      }

      const { text } = msg;
      if (!text || !text.trim()) return;

      // Echo back the transcript
      safeSend(ws, { type: 'transcript_final', data: { text: text.trim() } });

      // Process through the pipeline
      const result = await processUserSpeech(
        session.persona,
        text.trim(),
        session.conversationHistory,
        session.didStream,
      );

      // Send AI text to client
      safeSend(ws, { type: 'ai_text', data: { text: result.replyText } });

      // Send audio for local playback if available (as fallback)
      if (result.audioBuffer) {
        safeSend(ws, {
          type: 'ai_audio',
          data: { audioBase64: result.audioBuffer.toString('base64') },
        });
      }

      // Notify that D-ID is speaking
      if (result.didResult) {
        safeSend(ws, { type: 'did_speaking', data: {} });
      }

      // If no D-ID at all, tell client to use browser TTS
      if (!session.didStream && !result.audioBuffer) {
        safeSend(ws, {
          type: 'fallback_tts',
          data: { text: result.replyText },
        });
      }

      // Update transcript in DB
      if (session.callId) {
        try {
          updateCallEnd(session.callId); // Keep updated
        } catch {}
      }
      break;
    }

    case 'stop_call': {
      safeSend(ws, { type: 'call_ended', data: {} });
      await cleanupSession(ws, session);
      break;
    }

    case 'did_sdp_answer': {
      if (session.didStream) {
        await sendSDPAnswer(session.didStream.id, session.didStream.session_id, msg.answer);
      }
      break;
    }

    case 'did_ice_candidate': {
      if (session.didStream) {
        await sendICECandidate(session.didStream.id, session.didStream.session_id, msg.candidate);
      }
      break;
    }

    default:
      console.log('[WS] Unknown message type:', msg.type);
  }
}

async function cleanupSession(ws, session) {
  session.isActive = false;

  // Close D-ID stream
  if (session.didStream) {
    await closeStream(session.didStream.id, session.didStream.session_id);
    session.didStream = null;
  }

  // Finalize call history
  if (session.callId) {
    try {
      updateCallEnd(session.callId);
    } catch {}
  }
}

function safeSend(ws, data) {
  try {
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify(data));
    }
  } catch (err) {
    console.error('[WS] Send error:', err.message);
  }
}

module.exports = setupCallHandler;
