import { Wordmark } from '@/components/brand/wordmark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/features/auth/avatar';

/** Internal styleguide (roadmap 1.6 DoD) — not linked from the app. */
export default function StyleguidePage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-12 px-6 py-12">
      <header className="flex items-center justify-between">
        <Wordmark />
        <span className="text-sm text-zinc-500">design tokens · /dev/ui</span>
      </header>

      <Section title="Color tokens">
        <div className="flex flex-wrap gap-3">
          {[
            ['brand', 'bg-brand'],
            ['brand-strong', 'bg-brand-strong'],
            ['brand-soft', 'bg-brand-soft'],
            ['accent', 'bg-accent'],
            ['live', 'bg-live'],
            ['positive', 'bg-positive'],
            ['warning', 'bg-warning'],
            ['surface', 'bg-surface border border-edge'],
            ['surface-raised', 'bg-surface-raised'],
          ].map(([name, cls]) => (
            <div key={name} className="flex flex-col items-center gap-1.5">
              <div className={`size-14 rounded-lg ${cls}`} />
              <span className="text-xs text-zinc-500">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <p className="font-display text-3xl text-brand">LiloChat — wordmark only (Luckiest Guy)</p>
        <p className="text-2xl font-bold">Heading / Inter Bold</p>
        <p className="text-base text-zinc-300">Body / Inter Regular — chats, descriptions.</p>
        <p className="text-sm text-zinc-500">Caption / muted</p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid max-w-md gap-4">
          <Input label="Nickname" placeholder="video_wizard" />
          <Input label="With error" placeholder="oops" error="That nickname is taken." />
        </div>
      </Section>

      <Section title="Avatars (via gateway)">
        <div className="flex items-end gap-4">
          <Avatar seed="flavio" size="sm" />
          <Avatar seed="flavio" size="md" />
          <Avatar seed="flavio" size="lg" className="ring-2 ring-brand/40" />
        </div>
      </Section>

      <Section title="Card + glow">
        <div className="glow-brand max-w-sm rounded-xl border border-brand/40 bg-surface p-5">
          <p className="text-sm font-semibold">Live room card (hover state preview)</p>
          <p className="mt-1 text-xs text-zinc-400">purple glow border — CLAUDE.md §12.2</p>
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-edge pb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      {children}
    </section>
  );
}
