import { useRef, useState, useCallback } from 'react';

export default function HoldToTalk({ onAudioReady, disabled }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const [duration, setDuration] = useState(0);

  const startRecording = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (disabled || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        if (blob.size > 1000) onAudioReady(blob);
      };

      mr.start(100);
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 100);
    } catch (err) {
      console.error('Record error:', err);
    }
  }, [disabled, recording, onAudioReady]);

  const stopRecording = useCallback((e) => {
    if (e) e.preventDefault();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    setDuration(0);
  }, []);

  // Pointer events work on both touch and mouse, and don't trigger iOS context menu
  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    startRecording(e);
  }, [startRecording]);

  const handlePointerUp = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    stopRecording(e);
  }, [stopRecording]);

  const handlePointerLeave = useCallback((e) => {
    if (recording) stopRecording(e);
  }, [recording, stopRecording]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, []);

  return (
    <div
      style={styles.container}
      onContextMenu={handleContextMenu}
    >
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleContextMenu}
        disabled={disabled}
        style={{
          ...styles.holdBtn,
          background: recording ? '#e74c3c' : 'rgba(255,255,255,0.15)',
          transform: recording ? 'scale(0.95)' : 'scale(1)',
        }}
      >
        {recording ? (
          <div style={styles.recordingInfo}>
            <span style={styles.recDot}>●</span>
            <span>{duration / 10}s 松开发送</span>
          </div>
        ) : (
          <span style={styles.holdText}>按住 说话</span>
        )}
      </button>
    </div>
  );
}

const styles = {
  container: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 20,
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none',
    touchAction: 'none',
  },
  holdBtn: {
    width: 200,
    height: 52,
    borderRadius: 26,
    border: '1.5px solid rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s',
    backdropFilter: 'blur(10px)',
    WebkitTapHighlightColor: 'transparent',
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none',
    touchAction: 'none',
    outline: 'none',
  },
  holdText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 500,
    letterSpacing: 2,
    pointerEvents: 'none',
  },
  recordingInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#fff',
    fontSize: 14,
    pointerEvents: 'none',
  },
  recDot: {
    color: '#fff',
    animation: 'pulse 0.6s infinite',
    fontSize: 12,
  },
};
