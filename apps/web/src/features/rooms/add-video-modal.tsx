'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { addToQueueBodySchema, type AddToQueueBody } from '@lilochat/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError } from '@/lib/api';
import { addVideo } from './api';

const FRIENDLY: Record<string, string> = {
  DUPLICATE_VIDEO: 'That video is already in the queue.',
  VIDEO_NOT_EMBEDDABLE: 'This video cannot be played outside YouTube.',
  VIDEO_TOO_LONG: 'Videos longer than 4 hours are not allowed.',
  VIDEO_NOT_FOUND: 'YouTube does not know this video — check the link.',
  VIDEO_METADATA_UNAVAILABLE: 'YouTube is not answering right now — try again in a minute.',
};

export function AddVideoModal({
  roomId,
  open,
  onClose,
}: {
  roomId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { accessToken } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<AddToQueueBody>({ resolver: zodResolver(addToQueueBodySchema) });

  const onSubmit = form.handleSubmit(async (body) => {
    if (!accessToken) return;
    setServerError(null);
    try {
      await addVideo(roomId, body.videoUrl, accessToken);
      form.reset();
      onClose(); // queue:updated broadcast refreshes the list
    } catch (error) {
      const known = error instanceof ApiError && error.code ? FRIENDLY[error.code] : undefined;
      setServerError(known ?? 'Could not add the video. Please try again.');
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-1">
            <DialogTitle className="text-xl font-semibold text-zinc-100">Add a video</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Paste a YouTube link — it joins the end of the queue.
            </DialogDescription>
          </header>

          <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
            <Input
              label="YouTube URL"
              placeholder="https://youtu.be/…"
              error={form.formState.errors.videoUrl?.message}
              {...form.register('videoUrl')}
            />
            {serverError && <p className="text-sm text-live">{serverError}</p>}
            <Button type="submit" size="lg" loading={form.formState.isSubmitting} className="mt-2">
              Add to queue
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
