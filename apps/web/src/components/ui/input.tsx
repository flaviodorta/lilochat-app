import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-zinc-300">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(
          'focus-ring h-10 w-full rounded-lg border border-edge bg-surface px-3 text-sm text-zinc-100',
          'placeholder:text-zinc-500 transition-colors hover:border-zinc-600',
          error && 'border-live/60',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-live">{error}</p>}
    </div>
  );
});
