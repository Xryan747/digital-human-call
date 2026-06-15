import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoCall from '../components/VideoCall';
import TranscriptOverlay from '../components/TranscriptOverlay';
import HangupButton from '../components/HangupButton';
import StatusBar from '../components/StatusBar';
import HoldToTalk from '../components/HoldToTalk';
import { getWsUrl, getServerUrl } from '../services/config';

// ── WAV encoder ──
function encodeWav(audioBuffer) {
  const numChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = samples.length * (bitsPerSample / 8);
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  function ws(offset, str) { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }
  ws(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); ws(8, 'WAVE');
  ws(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true); view.setUint16(34, bitsPerSample, true);
  ws(36, 'data'); view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

// ── WebSocket ── (uses config service)

export default function CallPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const wsRef = useRef(null);

  const [persona, setPersona] = useState(null);
  const [streamData] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [lastUserText, setLastUserText] = useState('');
  const [lastAiText, setLastAiText] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [debugInfo, setDebugInfo] = useState('');
  const [asrProcessing, setAsrProcessing] = useState(false);

  // ── WebSocket ──
  useEffect(() => {
    let cancelled = false;
    let ws;
    function connect() {
      if (cancelled) return;
      ws = new WebSocket(getWsUrl());
      wsRef.current = ws;
      ws.onopen = () => {
        if (cancelled) { ws.close(); return; }
        ws.send(JSON.stringify({ type: 'start_call', personaId: id }));
      };
      ws.onmessage = (event) => {
        if (cancelled) return;
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        switch (msg.type) {
          case 'call_connected':
            setPersona(msg.data.persona);
            setWsStatus('connected');
            setDebugInfo('');
            break;
          case 'transcript_final':
            setLastUserText(msg.data.text);
            break;
          case 'ai_text':
            setLastAiText(msg.data.text);
            if ('speechSynthesis' in window) {
              speechSynthesis.cancel();
              const u = new SpeechSynthesisUtterance(msg.data.text);
              u.lang = 'zh-CN'; u.rate = 0.9; u.volume = 1;
              speechSynthesis.speak(u);
            }
            break;
          case 'error':
            setDebugInfo(msg.message);
            break;
        }
      };
      ws.onclose = () => { if (!cancelled) { setDebugInfo('连接断开'); setTimeout(connect, 1000); } };
    }
    connect();
    return () => { cancelled = true; if (ws) ws.close(); };
  }, [id]);

  // ── Camera ──
  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: 240, height: 320, facingMode: 'user' },
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = s;
        setLocalStream(s);
      } catch (e) { console.warn('Camera:', e.message); }
    })();
    return () => { if (localStream) localStream.getTracks().forEach(t => t.stop()); };
  }, []);

  // ── Timer ──
  useEffect(() => {
    if (wsStatus !== 'connected') return;
    const start = Date.now();
    const t = setInterval(() => setCallDuration(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [wsStatus]);

  // ── Send text to LLM ──
  const sendText = useCallback((text) => {
    if (!text.trim()) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'user_speech', text: text.trim() }));
      setDebugInfo('');
    }
  }, []);

  // ── Process recorded audio → ASR → LLM ──
  const processAudio = useCallback(async (audioBlob) => {
    setAsrProcessing(true);
    setDebugInfo('识别中...');
    try {
      // Decode the webm/mp4 blob to AudioBuffer (PCM)
      const audioCtx = new AudioContext();
      const arrayBuf = await audioBlob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
      audioCtx.close();

      // Encode as WAV
      const wavBlob = encodeWav(audioBuffer);

      // Send to backend ASR
      const form = new FormData();
      form.append('audio', wavBlob, 'speech.wav');
      const res = await fetch(`${getServerUrl()}/api/asr`, { method: 'POST', body: form });
      const data = await res.json();

      if (data.success && data.data.text) {
        setDebugInfo('');
        sendText(data.data.text);
      } else {
        setDebugInfo('未识别到语音');
      }
    } catch (err) {
      console.error('ASR error:', err);
      setDebugInfo(`识别失败: ${err.message}`);
    } finally {
      setAsrProcessing(false);
    }
  }, [sendText]);

  // ── Hangup ──
  function handleHangup() {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: 'stop_call' })); } catch {}
      wsRef.current.close();
    }
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    navigate('/');
  }

  const mins = Math.floor(callDuration / 60);
  const secs = callDuration % 60;

  if (wsStatus === 'connecting') {
    return (
      <div style={styles.loading}>
        <div className="spinner" />
        <p style={{ color: '#a0a0a0', marginTop: 16 }}>正在连接...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Full-screen video/photo */}
      <VideoCall
        remoteVideoRef={remoteVideoRef}
        photoUrl={persona?.photoUrl}
        streamAvailable={!!streamData}
      />

      {/* PIP self-view */}
      <video ref={localVideoRef} autoPlay playsInline muted style={styles.pip} />

      {/* Status bar */}
      <StatusBar
        personaName={persona?.name || ''}
        duration={`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`}
        isConnected={wsStatus === 'connected'}
      />

      {/* Transcript */}
      <TranscriptOverlay userText={lastUserText} aiText={lastAiText} />

      {/* Debug / ASR status */}
      {(debugInfo || asrProcessing) && (
        <div style={styles.asrStatus}>
          {asrProcessing && <span style={styles.dot} />}
          {debugInfo || '识别中...'}
        </div>
      )}

      {/* Hold-to-talk button (primary) */}
      <HoldToTalk
        onAudioReady={processAudio}
        disabled={wsStatus !== 'connected'}
      />

      {/* Hangup */}
      <HangupButton onClick={handleHangup} />
    </div>
  );
}

const styles = {
  page: { height: '100%', width: '100%', background: '#000', position: 'relative', overflow: 'hidden' },
  loading: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000' },
  pip: { position: 'absolute', top: 12, right: 12, width: 100, height: 140, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(255,255,255,0.3)', background: '#333', zIndex: 20 },
  asrStatus: { position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 13, background: 'rgba(0,0,0,0.6)', padding: '6px 16px', borderRadius: 20, zIndex: 15, display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: '50%', background: '#07C160', animation: 'pulse 0.8s infinite' },
};
