import { useEffect, useRef } from 'react';

interface Options {
  /** Called with the trimmed badge string when a scan completes. */
  onScan: (badge: string) => void;
  /** Skip scans while true (e.g. when a modal is open). */
  paused?: boolean;
  /** Minimum buffer length before a scan is fired. */
  minLength?: number;
  /** Idle timeout (ms) before the buffer is treated as complete. */
  idleTimeout?: number;
  /** Inactivity reset window (ms): if no key has been pressed for longer, the buffer clears. */
  resetWindow?: number;
}

/**
 * Captures keystrokes from an HID badge reader, which behaves like a keyboard
 * that types the badge ID followed by Enter. We buffer characters and submit
 * either when Enter is pressed or when the user has been idle for a short
 * window (some readers do not emit Enter).
 */
export function useBadgeScanner({
  onScan,
  paused = false,
  minLength = 4,
  idleTimeout = 300,
  resetWindow = 2000,
}: Options) {
  const bufferRef = useRef('');
  const lastKeyRef = useRef(0);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const submit = () => {
      const badge = bufferRef.current.trim();
      bufferRef.current = '';
      if (badge.length >= minLength) onScan(badge);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (paused) return;
      const now = Date.now();
      if (now - lastKeyRef.current > resetWindow && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }
      lastKeyRef.current = now;

      if (e.key === 'Enter') {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        submit();
        return;
      }
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(submit, idleTimeout);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [onScan, paused, minLength, idleTimeout, resetWindow]);
}
