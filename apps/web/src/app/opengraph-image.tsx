import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'LiloChat — watch YouTube together, in perfect sync';

/** The default share card: brand, tagline, glow. */
export default async function HomeOgImage() {
  let logo = '';
  try {
    const svg = await readFile(join(process.cwd(), 'public', 'lilochat-logo.svg'));
    logo = `data:image/svg+xml;base64,${svg.toString('base64')}`;
  } catch {
    /* text-only card still reads fine */
  }

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 34,
        backgroundColor: '#09090b',
        backgroundImage:
          'radial-gradient(circle at 50% 120%, rgba(147,51,234,0.45), rgba(9,9,11,0) 60%)',
      }}
    >
      {logo ? <img src={logo} alt="" width={160} height={148} /> : null}
      <div
        style={{
          display: 'flex',
          fontSize: 68,
          fontWeight: 700,
          color: '#fafafa',
          textAlign: 'center',
          lineHeight: 1.15,
          maxWidth: 900,
        }}
      >
        Watch YouTube together, in perfect sync
      </div>
      <div style={{ display: 'flex', fontSize: 30, color: '#a1a1aa' }}>
        Live rooms · shared queue · skip votes — nobody can pause
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 10,
          display: 'flex',
          background: 'linear-gradient(to right, #9333ea, #d946ef)',
        }}
      />
    </div>,
    size,
  );
}
