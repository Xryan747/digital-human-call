export default function StatusBar({ personaName, duration, isConnected, isListening = false, speechSupported = true }) {
  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <span style={{
          ...styles.dot,
          background: isConnected ? '#07C160' : '#e74c3c',
        }} />
        <span style={styles.name}>{personaName || '连接中...'}</span>
      </div>
      <div style={styles.right}>
        <span style={styles.duration}>{duration}</span>
      </div>
    </div>
  );
}

const styles = {
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 15,
    pointerEvents: 'none',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
  },
  name: {
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  duration: {
    fontSize: 14,
    color: '#fff',
    fontVariantNumeric: 'tabular-nums',
    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
  },
  listening: {
    display: 'flex',
    alignItems: 'center',
  },
  micIcon: {
    fontSize: 14,
    animation: 'pulse 1s infinite',
  },
  warning: {
    fontSize: 11,
    color: '#ffa500',
    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
  },
};
