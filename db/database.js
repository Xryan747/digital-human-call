/**
 * JSON file-based database
 * Simple persistence without native dependencies
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

let data = { personas: [], calls: [] };
let initialized = false;

function initDb() {
  if (initialized) return;
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      data.personas = parsed.personas || [];
      data.calls = parsed.calls || [];
    } catch (err) {
      console.warn('[DB] Could not parse data.json, starting fresh:', err.message);
      data = { personas: [], calls: [] };
    }
  }
  initialized = true;
  console.log(`[DB] Loaded ${data.personas.length} personas, ${data.calls.length} calls`);
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Persona queries
function listPersonas() {
  return [...data.personas]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(p => ({
      id: p.id,
      name: p.name,
      photo_url: p.photo_url,
      audio_url: p.audio_url,
      profile: p.profile || {},
      created_at: p.created_at,
    }));
}

function getPersona(id) {
  const persona = data.personas.find(p => p.id === id);
  if (!persona) return null;
  return { ...persona, profile: persona.profile || {} };
}

function insertPersona(persona) {
  const record = {
    id: persona.id,
    name: persona.name,
    photo_url: persona.photo_url || null,
    audio_url: persona.audio_url || null,
    profile: persona.profile || {},
    system_prompt: persona.system_prompt || '',
    chat_logs: persona.chat_logs || null,
    created_at: persona.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  data.personas.push(record);
  save();
  return getPersona(record.id);
}

function deletePersona(id) {
  const idx = data.personas.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const persona = data.personas[idx];
  data.personas.splice(idx, 1);
  // Also delete associated calls
  data.calls = data.calls.filter(c => c.persona_id !== id);
  save();
  return persona;
}

// Call history queries
function insertCallHistory(call) {
  const record = {
    id: call.id,
    persona_id: call.persona_id,
    started_at: new Date().toISOString(),
    ended_at: null,
    transcript: call.transcript || [],
  };
  data.calls.push(record);
  save();
  return record;
}

function updateCallEnd(callId) {
  const call = data.calls.find(c => c.id === callId);
  if (call) {
    call.ended_at = new Date().toISOString();
    // Update transcript from session if passed
    save();
  }
}

function updateCallTranscript(callId, transcript) {
  const call = data.calls.find(c => c.id === callId);
  if (call) {
    call.transcript = transcript;
    save();
  }
}

function getCallHistory(personaId) {
  return data.calls
    .filter(c => c.persona_id === personaId)
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
}

module.exports = {
  initDb,
  listPersonas,
  getPersona,
  insertPersona,
  deletePersona,
  insertCallHistory,
  updateCallEnd,
  updateCallTranscript,
  getCallHistory,
};
