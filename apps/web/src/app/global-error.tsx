'use client';

/**
 * Last-resort boundary: replaces the ROOT layout, so no Header/Providers/fonts
 * here — inline the minimum brand so even a broken shell looks intentional.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          background: '#09090b',
          color: '#e4e4e7',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        <p style={{ fontSize: '3rem', fontWeight: 700, color: '#a855f7', margin: 0 }}>LiloChat</p>
        <p style={{ margin: 0 }}>The whole set went dark. One sec —</p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: 'linear-gradient(to right, #9333ea, #d946ef)',
            color: 'white',
            border: 0,
            borderRadius: '9999px',
            padding: '0.6rem 1.4rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
