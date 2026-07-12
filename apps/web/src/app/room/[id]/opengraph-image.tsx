import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'A LiloChat room, live';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

interface RoomSnapshot {
  name?: string;
  viewers?: number;
  playback?: { title?: string; thumbUrl?: string } | null;
}

/** §7.2: OG card per room — current video thumb + name + live state. */
export default async function RoomOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let room: RoomSnapshot = {};
  try {
    const response = await fetch(`${API_URL}/rooms/${id}`, { cache: 'no-store' });
    if (response.ok) room = (await response.json()) as RoomSnapshot;
  } catch {
    /* directory unreachable → brand-only card */
  }

  let logo = '';
  try {
    const svg = await readFile(join(process.cwd(), 'public', 'lilochat-logo.svg'));
    logo = `data:image/svg+xml;base64,${svg.toString('base64')}`;
  } catch {
    /* card works without the mark */
  }

  const name = room.name ?? 'Watch together';
  const thumb = room.playback?.thumbUrl;
  const viewers = room.viewers ?? 0;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        backgroundColor: '#09090b',
        position: 'relative',
      }}
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          width={1200}
          height={630}
          style={{ position: 'absolute', inset: 0, objectFit: 'cover', opacity: 0.55 }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          background:
            'linear-gradient(to top, #09090b 8%, rgba(9,9,11,0.45) 55%, rgba(9,9,11,0.15))',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 64,
          right: 64,
          bottom: 56,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {logo ? <img src={logo} alt="" width={84} height={78} /> : null}
          <div
            style={{
              display: 'flex',
              fontSize: 64,
              fontWeight: 700,
              color: '#fafafa',
              lineHeight: 1.1,
              maxWidth: 980,
            }}
          >
            {name}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#fb7185',
              fontWeight: 700,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 16,
                height: 16,
                borderRadius: 999,
                backgroundColor: '#f43f5e',
              }}
            />
            LIVE
          </div>
          <div style={{ display: 'flex', color: '#a1a1aa' }}>
            {viewers > 0 ? `${viewers} watching · ` : ''}in perfect sync on LiloChat
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 0,
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
