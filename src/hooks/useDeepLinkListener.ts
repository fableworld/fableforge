import { useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { pendingDeepLinkAtom } from '@/stores/deeplink';
import { parseDeepLink } from '@/services/deeplink';

// Debounce window in milliseconds
const DEBOUNCE_MS = 2000;

/**
 * Hook that listens for fableforge:// deep link events (cold start + warm start).
 *
 * - Cold start: uses `getCurrent()` to check if the app was launched via deep link
 * - Warm start: uses `onOpenUrl()` to listen for deep links while app is running
 * - Debounces rapid duplicate links (2s window)
 * - Does NOT auto-process if another deep link is already being resolved
 *
 * Must be called once in App.tsx.
 */
export function useDeepLinkListener() {
  const setPendingDeepLink = useSetAtom(pendingDeepLinkAtom);
  const lastLinkRef = useRef<string | null>(null);
  const lastLinkTimeRef = useRef<number>(0);

  const handleUrls = (urls: string[]) => {
    for (const rawUrl of urls) {
      const now = Date.now();

      // Debounce: skip if same URL arrived within the window
      if (
        rawUrl === lastLinkRef.current &&
        now - lastLinkTimeRef.current < DEBOUNCE_MS
      ) {
        console.log('[deep-link] Debounced duplicate URL:', rawUrl);
        continue;
      }

      lastLinkRef.current = rawUrl;
      lastLinkTimeRef.current = now;

      const result = parseDeepLink(rawUrl);
      if (!result.ok) {
        console.warn('[deep-link] Invalid deep link:', result.error.message);
        continue;
      }

      console.log('[deep-link] Parsed deep link:', result.data);
      setPendingDeepLink(result.data);
    }
  };

  useEffect(() => {
    let cleanupFn: (() => void) | null = null;

    const init = async () => {
      try {
        // Dynamic import to avoid issues when not running in Tauri context (e.g., tests)
        const { getCurrent, onOpenUrl } = await import(
          '@tauri-apps/plugin-deep-link'
        );

        // Cold start: check if the app was launched via a deep link
        const startUrls = await getCurrent();
        if (startUrls && startUrls.length > 0) {
          console.log('[deep-link] Cold start URLs:', startUrls);
          handleUrls(startUrls);
        }

        // Warm start: listen for deep links while the app is running
        const unlisten = await onOpenUrl((urls) => {
          console.log('[deep-link] Warm start URLs:', urls);
          handleUrls(urls);
        });

        cleanupFn = unlisten;
      } catch (e) {
        console.warn('[deep-link] Plugin not available (expected in browser dev):', e);
      }
    };

    init();

    return () => {
      cleanupFn?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
