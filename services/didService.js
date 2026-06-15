/**
 * D-ID Streaming Service
 * Manages real-time talking head streaming sessions
 */

const DID_BASE = 'https://api.d-id.com';

async function createStream(sourceImageUrl) {
  console.log('[D-ID] Creating stream...');

  const response = await fetch(`${DID_BASE}/talks/streams`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${process.env.DID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_url: sourceImageUrl,
      driver_url: 'bank://lively',
      config: { stitch: true },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`D-ID create stream failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  console.log(`[D-ID] Stream created: ${data.id}`);
  return data;
}

async function sendText(streamId, sessionId, text) {
  console.log(`[D-ID] Sending text to ${streamId}: "${text.slice(0, 50)}..."`);

  const response = await fetch(`${DID_BASE}/talks/streams/${streamId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${process.env.DID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      script: {
        type: 'text',
        input: text,
        provider: {
          type: 'microsoft',
          voice_id: 'zh-CN-XiaoxiaoNeural',
        },
      },
      session_id: sessionId,
      driver_url: 'bank://lively',
      config: { stitch: true },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`D-ID send text failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  console.log(`[D-ID] Text sent, talk_id: ${data.id || 'pending'}`);
  return data;
}

async function sendAudio(streamId, sessionId, audioBase64) {
  console.log(`[D-ID] Sending audio to ${streamId} (${audioBase64.length} chars base64)`);

  const response = await fetch(`${DID_BASE}/talks/streams/${streamId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${process.env.DID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      script: {
        type: 'audio',
        audio: audioBase64,
      },
      session_id: sessionId,
      driver_url: 'bank://lively',
      config: { stitch: true },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`D-ID send audio failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  console.log(`[D-ID] Audio sent, talk_id: ${data.id || 'pending'}`);
  return data;
}

async function sendSDPAnswer(streamId, sessionId, answer) {
  const response = await fetch(`${DID_BASE}/talks/streams/${streamId}/sdp`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${process.env.DID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ answer, session_id: sessionId }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`D-ID SDP answer failed (${response.status}): ${errText}`);
  }
  console.log('[D-ID] SDP answer sent');
}

async function sendICECandidate(streamId, sessionId, candidate) {
  const response = await fetch(`${DID_BASE}/talks/streams/${streamId}/ice`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${process.env.DID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ candidate, session_id: sessionId }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`D-ID ICE candidate failed (${response.status}): ${errText}`);
  }
}

async function closeStream(streamId, sessionId) {
  console.log(`[D-ID] Closing stream ${streamId}`);
  try {
    await fetch(`${DID_BASE}/talks/streams/${streamId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${process.env.DID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id: sessionId }),
    });
    console.log('[D-ID] Stream closed');
  } catch (err) {
    console.error('[D-ID] Error closing stream:', err.message);
  }
}

module.exports = {
  createStream,
  sendText,
  sendAudio,
  sendSDPAnswer,
  sendICECandidate,
  closeStream,
};
