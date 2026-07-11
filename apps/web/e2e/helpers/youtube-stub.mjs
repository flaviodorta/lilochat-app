// YouTube Data API stub for E2E: every video exists, is embeddable and lasts 8s
// (short enough to watch the auto-advance fire inside the flagship test).
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 4199);

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://stub');
    const id = url.searchParams.get('id') ?? 'unknown0000';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        items: [
          {
            id,
            snippet: {
              title: `E2E Video ${id}`,
              thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } },
            },
            contentDetails: { duration: 'PT15S' },
            status: { embeddable: true },
          },
        ],
      }),
    );
  })
  .listen(PORT, () => console.log(`youtube stub on :${PORT}`));
