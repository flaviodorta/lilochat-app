'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createRoomBodySchema, type CreateRoomBody } from '@lilochat/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError } from '@/lib/api';
import { createRoom } from './api';

export function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CreateRoomBody>({ resolver: zodResolver(createRoomBodySchema) });

  const onSubmit = form.handleSubmit(async (body) => {
    if (!accessToken) return;
    setServerError(null);
    try {
      const room = await createRoom(body, accessToken);
      onClose();
      router.push(`/room/${room.id}`);
    } catch (error) {
      setServerError(
        error instanceof ApiError && error.message
          ? error.message
          : 'Could not create the room. Please try again.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-1">
            <DialogTitle className="text-xl font-semibold text-zinc-100">Create a room</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Name it, drop the first video, and the channel goes live.
            </DialogDescription>
          </header>

          <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
            <Input
              label="Room name"
              placeholder="Lofi & Chill"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <Input
              label="First YouTube video"
              placeholder="https://www.youtube.com/watch?v=…"
              error={form.formState.errors.firstVideoUrl?.message}
              {...form.register('firstVideoUrl')}
            />

            {serverError && <p className="text-sm text-live">{serverError}</p>}

            <Button type="submit" size="lg" loading={form.formState.isSubmitting} className="mt-2">
              Go live
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
