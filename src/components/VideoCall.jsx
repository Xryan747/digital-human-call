import { useEffect, useRef } from 'react';

export default function VideoCall({ remoteVideoRef, photoUrl, streamAvailable }) {
  const photoImgRef = useRef(null);

  // Show photo when no video stream
  const showPhoto = !streamAvailable && photoUrl;

  return (
    <div style={styles.container}>
      {/* Remote video (D-ID WebRTC stream) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          ...styles.video,
          display: streamAvailable ? 'block' : 'none',
        }}
      />

      {/* Static photo fallback */}
      {showPhoto && (
        <img
          ref={photoImgRef}
          src={photoUrl}
          alt="数字人"
          style={styles.photo}
        />
      )}

      {!streamAvailable && !photoUrl && (
        <div style={styles.noVideo}>
          <p style={{ fontSize: 64 }}>👤</p>
          <p style={styles.noVideoText}>等待连接...</p>
        </div>
      )}

      {/* Gradient overlay for UI readability */}
      <div style={styles.gradientTop} />
      <div style={styles.gradientBottom} />
    </div>
  );
}

const styles = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: '#000',
    zIndex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  noVideo: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
  },
  noVideoText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',
    pointerEvents: 'none',
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
    pointerEvents: 'none',
  },
};
