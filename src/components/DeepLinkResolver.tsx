import { useEffect, useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, AlertCircle, Globe, AlertTriangle, X } from 'lucide-react';

import {
  pendingDeepLinkAtom,
  deepLinkProcessingAtom,
  ephemeralCharacterAtom,
  ephemeralRegistryMetaAtom,
  ephemeralRegistryUrlAtom,
} from '@/stores/deeplink';
import { charactersAtom, registriesAtom } from '@/stores/registries';
import { collectionsAtom } from '@/stores/collections';
import { registryService } from '@/services/registry';
import { detectIdClashes, type ClashInfo } from '@/services/clash';
import { urlsMatch } from '@/lib/url';
import type { DeepLinkRequest } from '@/services/deeplink';
import type { Character, Registry } from '@/lib/schemas';

// --- State Machine ---
type ResolverState =
  | { step: 'idle' }
  | { step: 'resolving'; request: DeepLinkRequest }
  | { step: 'error'; title: string; message: string; details?: string }
  | { step: 'import-prompt'; request: DeepLinkRequest; registry: Registry; registryUrl: string }
  | { step: 'clash-warning'; request: DeepLinkRequest; registry: Registry; registryUrl: string; clashes: ClashInfo[] }
  | { step: 'busy' };

const FETCH_TIMEOUT_MS = 10_000;

/**
 * DeepLinkResolver — orchestrates the entire deep link resolution flow.
 * Mounted in App.tsx, it watches `pendingDeepLinkAtom` and drives the
 * state machine through modals (loading, error, import prompt, clash warning).
 */
export function DeepLinkResolver() {
  const [pending, setPending] = useAtom(pendingDeepLinkAtom);
  const [, setProcessing] = useAtom(deepLinkProcessingAtom);
  const setEphemeralCharacter = useSetAtom(ephemeralCharacterAtom);
  const setEphemeralMeta = useSetAtom(ephemeralRegistryMetaAtom);
  const setEphemeralRegistryUrl = useSetAtom(ephemeralRegistryUrlAtom);

  const [characters, setCharacters] = useAtom(charactersAtom);
  const registries = useAtomValue(registriesAtom);
  const collections = useAtomValue(collectionsAtom);

  const navigate = useNavigate();
  const location = useLocation();

  const [state, setState] = useState<ResolverState>({ step: 'idle' });

  // --- Core Resolution Logic ---

  const resolve = useCallback(async (request: DeepLinkRequest) => {
    setProcessing(true);
    setState({ step: 'resolving', request });

    try {
      const { characterId, registryUrl } = request;

      // 1. Check if registry is already imported
      const existingRegistry = registries.find((r) => urlsMatch(r.url, registryUrl));

      if (existingRegistry) {
        // Registry is known
        let found = characters.find(
          (c) => c.id === characterId && c.registry_url && urlsMatch(c.registry_url, registryUrl)
        );

        if (found) {
          // Flow 1: Character found in existing registry → navigate
          navigateToCharacter(characterId);
          return;
        }

        // Flow 2: Character not found → refresh registry
        try {
          await fetchWithTimeout(
            () => registryService.fetchRegistry(registryUrl),
            FETCH_TIMEOUT_MS
          );

          // Reload characters
          const data = await registryService.loadAll();
          setCharacters(data.characters);

          found = data.characters.find(
            (c) => c.id === characterId && c.registry_url && urlsMatch(c.registry_url, registryUrl)
          );

          if (found) {
            navigateToCharacter(characterId);
            return;
          }
        } catch {
          // Refresh failed — fall through to error
        }

        // Character still not found after refresh
        setState({
          step: 'error',
          title: 'Personaggio non trovato',
          message: `Il personaggio "${characterId}" non è presente nel registry "${existingRegistry.meta.name}".`,
          details: `ID: ${characterId}\nRegistry: ${registryUrl}\n\nIl link potrebbe essere scaduto o il personaggio potrebbe essere stato rimosso.`,
        });
        return;
      }

      // 3. Registry not imported → try to download index
      let registry: Registry;
      try {
        const result = await fetchWithTimeout(
          () => registryService.fetchRegistryWithoutPersist(registryUrl),
          FETCH_TIMEOUT_MS,
        );
        registry = result.registry;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Errore sconosciuto';
        setState({
          step: 'error',
          title: 'Registry non raggiungibile',
          message: `Non è stato possibile scaricare il registry.`,
          details: `URL: ${registryUrl}\nErrore: ${errorMsg}\n\nVerifica che l'URL sia corretto e raggiungibile.`,
        });
        return;
      }

      // Check if character exists in downloaded registry
      const charInRegistry = registry.characters.find((c) => c.id === characterId);
      if (!charInRegistry) {
        setState({
          step: 'error',
          title: 'Personaggio non trovato',
          message: `Il personaggio "${characterId}" non è presente nel registry "${registry.meta.name}".`,
          details: `ID: ${characterId}\nRegistry: ${registryUrl}\n\nIl link potrebbe essere scaduto o mal formattato.`,
        });
        return;
      }

      // Ask user: import or view ephemerally?
      setState({
        step: 'import-prompt',
        request,
        registry,
        registryUrl,
      });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Errore sconosciuto';
      setState({
        step: 'error',
        title: 'Errore imprevisto',
        message: 'Si è verificato un errore durante la risoluzione del deep link.',
        details: errorMsg,
      });
    } finally {
      setProcessing(false);
    }
  }, [registries, characters, setCharacters, setProcessing, navigate, location]);

  // --- Action Handlers ---

  const handleImport = useCallback(async (
    request: DeepLinkRequest,
    registry: Registry,
    registryUrl: string,
  ) => {
    setProcessing(true);
    setState({ step: 'resolving', request });

    try {
      // Check for ID clashes before importing
      const clashes = detectIdClashes(registry.characters, characters, collections);

      if (clashes.length > 0) {
        setState({
          step: 'clash-warning',
          request,
          registry,
          registryUrl,
          clashes,
        });
        setProcessing(false);
        return;
      }

      // No clashes — proceed with import
      await doImport(request, registryUrl);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Errore sconosciuto';
      setState({
        step: 'error',
        title: 'Errore durante l\'importazione',
        message: 'Non è stato possibile importare il registry.',
        details: errorMsg,
      });
      setProcessing(false);
    }
  }, [characters, collections, setProcessing]);

  const doImport = useCallback(async (request: DeepLinkRequest, registryUrl: string) => {
    try {
      await registryService.fetchRegistry(registryUrl);
      const data = await registryService.loadAll();
      setCharacters(data.characters);

      navigateToCharacter(request.characterId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Errore sconosciuto';
      setState({
        step: 'error',
        title: 'Errore durante l\'importazione',
        message: 'Non è stato possibile importare il registry.',
        details: errorMsg,
      });
    } finally {
      setProcessing(false);
    }
  }, [setCharacters, setProcessing]);

  const handleViewEphemeral = useCallback((
    request: DeepLinkRequest,
    registry: Registry,
    registryUrl: string,
  ) => {
    const character = registry.characters.find((c) => c.id === request.characterId);
    if (!character) return;

    // Tag with registry_url for display
    const taggedCharacter: Character = {
      ...character,
      registry_url: registryUrl,
    };

    setEphemeralCharacter(taggedCharacter);
    setEphemeralMeta(registry.meta);
    setEphemeralRegistryUrl(registryUrl);
    navigateToCharacter(request.characterId);
  }, [setEphemeralCharacter, setEphemeralMeta, setEphemeralRegistryUrl]);

  const navigateToCharacter = useCallback((characterId: string) => {
    setState({ step: 'idle' });
    setPending(null);
    // Use replace if we're at root (cold start), push otherwise
    const isRoot = location.pathname === '/';
    if (isRoot) {
      navigate(`/character/${characterId}`, { replace: true });
    } else {
      navigate(`/character/${characterId}`);
    }
  }, [navigate, location.pathname, setPending]);

  const handleDismiss = useCallback(() => {
    setState({ step: 'idle' });
    setPending(null);
    setProcessing(false);
  }, [setPending, setProcessing]);

  // --- Trigger resolution when a pending deep link arrives ---

  useEffect(() => {
    if (pending && state.step === 'idle') {
      resolve(pending);
    }
  }, [pending, state.step, resolve]);

  // --- Render Modals ---

  if (state.step === 'idle') return null;

  return (
    <>
      {/* Loading Modal */}
      {state.step === 'resolving' && (
        <Dialog.Root open modal>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content" onPointerDownOutside={(e) => e.preventDefault()}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) 0' }}>
                <Loader2 size={32} className="spin" style={{ color: 'var(--color-primary-500)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>
                    Risoluzione del personaggio...
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                    ID: {state.request.characterId}
                  </div>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Error Modal */}
      {state.step === 'error' && (
        <Dialog.Root open onOpenChange={() => handleDismiss()}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content">
              <div className="dialog-header">
                <Dialog.Title className="dialog-title">
                  <AlertCircle size={18} style={{ color: 'var(--color-danger-500)' }} />
                  {state.title}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="btn btn--ghost btn--icon btn--sm">
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>

              <Dialog.Description className="dialog-description">
                {state.message}
              </Dialog.Description>

              {state.details && (
                <div style={{
                  padding: 'var(--space-3)',
                  background: 'var(--color-bg-sunken)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 'var(--space-4)',
                }}>
                  {state.details}
                </div>
              )}

              <div className="dialog-actions">
                <button className="btn btn--primary" onClick={handleDismiss}>
                  Chiudi
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Import Prompt Modal */}
      {state.step === 'import-prompt' && (
        <Dialog.Root open onOpenChange={() => handleDismiss()}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content">
              <div className="dialog-header">
                <Dialog.Title className="dialog-title">
                  <Globe size={18} style={{ color: 'var(--color-primary-500)' }} />
                  Registry sconosciuto
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="btn btn--ghost btn--icon btn--sm">
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>

              <Dialog.Description className="dialog-description">
                Il personaggio appartiene al registry <strong>"{state.registry.meta.name}"</strong> che non è ancora monitorato.
                Vuoi aggiungerlo ai registry monitorati o visualizzare solo il personaggio?
              </Dialog.Description>

              <div style={{
                padding: 'var(--space-3)',
                background: 'var(--color-bg-sunken)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--space-2)',
              }}>
                <div><strong>Registry:</strong> {state.registry.meta.name}</div>
                {state.registry.meta.maintainer && (
                  <div><strong>Manutentore:</strong> {state.registry.meta.maintainer}</div>
                )}
                <div><strong>Personaggi:</strong> {state.registry.characters.length}</div>
              </div>

              <div className="dialog-actions" style={{ flexWrap: 'wrap' }}>
                <button className="btn btn--secondary" onClick={handleDismiss}>
                  Annulla
                </button>
                <button
                  className="btn btn--secondary"
                  onClick={() => handleViewEphemeral(state.request, state.registry, state.registryUrl)}
                >
                  Solo visualizza
                </button>
                <button
                  className="btn btn--primary"
                  onClick={() => handleImport(state.request, state.registry, state.registryUrl)}
                >
                  Importa registry
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Clash Warning Modal */}
      {state.step === 'clash-warning' && (
        <Dialog.Root open onOpenChange={() => handleDismiss()}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content" style={{ width: 'min(540px, 90vw)' }}>
              <div className="dialog-header">
                <Dialog.Title className="dialog-title">
                  <AlertTriangle size={18} style={{ color: 'var(--color-warning-500)' }} />
                  Conflitti di ID rilevati
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="btn btn--ghost btn--icon btn--sm">
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>

              <Dialog.Description className="dialog-description">
                Importando questo registry, alcuni personaggi verranno nascosti perché hanno lo stesso ID
                di personaggi già esistenti. Le collezioni locali hanno sempre priorità.
              </Dialog.Description>

              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 'var(--text-xs)',
                }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-sunken)' }}>
                      <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left' }}>Nuovo</th>
                      <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left' }}>Esistente</th>
                      <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left' }}>Fonte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.clashes.map((clash) => (
                      <tr key={clash.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: 'var(--space-2) var(--space-3)' }}>{clash.newName}</td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)' }}>{clash.existingName}</td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                          <span className={`badge ${clash.existingSource === 'collection' ? 'badge--primary' : 'badge--success'}`}>
                            {clash.existingSource === 'collection' ? 'Locale' : 'Registry'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="dialog-actions">
                <button className="btn btn--secondary" onClick={handleDismiss}>
                  Annulla
                </button>
                <button
                  className="btn btn--primary"
                  onClick={() => doImport(state.request, state.registryUrl)}
                >
                  Importa comunque
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}

// --- Helpers ---

async function fetchWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout dopo ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}
