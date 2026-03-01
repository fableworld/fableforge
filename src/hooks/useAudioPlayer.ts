import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface AudioPlayerState {
    /** ID of the track currently playing */
    playingTrackId: string | null;
    /** ID of the track currently loading (buffering) */
    loadingTrackId: string | null;
}

interface AudioPlayerActions {
    /**
     * Play a track. If another track is already playing, it is stopped first.
     * @param trackId  Unique identifier for this track (e.g. `${characterId}-${index}`)
     * @param source   Either a local file path or a remote URL
     */
    play: (trackId: string, source: string) => void;
    /** Stop current playback */
    stop: () => void;
    /** Check if a specific track is currently playing */
    isPlaying: (trackId: string) => boolean;
    /** Check if a specific track is currently loading */
    isLoading: (trackId: string) => boolean;
}

/**
 * Determine if a source is a local file path (not http/https).
 */
function isLocalPath(source: string): boolean {
    return !source.startsWith("http://") && !source.startsWith("https://") && !source.startsWith("blob:");
}

/**
 * Custom hook for audio playback.
 *
 * - Manages a singleton HTMLAudioElement
 * - Only one track plays at a time
 * - Automatically stops on route change
 * - Primary: Tauri asset protocol (streaming support)
 * - Fallback: read via Tauri → Blob URL (for Linux compatibility)
 */
export function useAudioPlayer(): AudioPlayerState & AudioPlayerActions {
    const [state, setState] = useState<AudioPlayerState>({
        playingTrackId: null,
        loadingTrackId: null,
    });

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const trackIdRef = useRef<string | null>(null);
    const blobUrlRef = useRef<string | null>(null);
    const location = useLocation();

    // Release audio resources
    const releaseAudio = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.removeAttribute("src");
            audio.load();
        }
        
        // Also stop native
        invoke("stop_audio_native").catch((e) => console.error("Native stop error", e));

        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }
        trackIdRef.current = null;
    }, []);

    // Public stop function
    const stopInternal = useCallback(() => {
        releaseAudio();
        setState({ playingTrackId: null, loadingTrackId: null });
    }, [releaseAudio]);

    // Stop playback on route change
    useEffect(() => {
        stopInternal();
    }, [location.pathname, stopInternal]);

    // Listen for native audio ending
    useEffect(() => {
        const unlisten = listen("audio-ended", () => {
            console.log("[AudioPlayer] Native audio ended");
            trackIdRef.current = null;
            setState({ playingTrackId: null, loadingTrackId: null });
        });
        return () => {
            unlisten.then((f) => f());
        };
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            releaseAudio();
        };
    }, [releaseAudio]);

    /**
     * Internal play function that attempts to play a given SRC.
     * Returns true if playback started successfully.
     */
    const attemptPlay = useCallback(async (trackId: string, src: string): Promise<boolean> => {
        if (!audioRef.current) audioRef.current = new Audio();
        const audio = audioRef.current;

        // Prepare for new source
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        
        audio.preload = "auto";
        
        // Remove previous listeners
        audio.onended = null;
        audio.onerror = null;

        return new Promise((resolve, reject) => {
            const onEnded = () => {
                if (trackIdRef.current === trackId) {
                    console.log("[AudioPlayer] Track ended:", trackId);
                    trackIdRef.current = null;
                    setState({ playingTrackId: null, loadingTrackId: null });
                }
            };

            const onError = (e: any) => {
                console.error("[AudioPlayer] Element error:", e);
                reject(new Error("Audio element error"));
            };

            // Wait until the browser estimates it can play the whole thing
            const onCanPlayThrough = () => {
                console.log("[AudioPlayer] Ready to play through:", trackId);
                audio.play()
                    .then(() => {
                        if (trackIdRef.current === trackId) {
                            setState({ playingTrackId: trackId, loadingTrackId: null });
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    })
                    .catch((err) => {
                        if (err.name === "AbortError") {
                            resolve(false);
                        } else {
                            reject(err);
                        }
                    });
            };

            // Attach listeners BEFORE setting src
            audio.addEventListener("ended", onEnded, { once: true });
            audio.addEventListener("error", onError, { once: true });
            audio.addEventListener("canplaythrough", onCanPlayThrough, { once: true });
            
            audio.src = src;

            // Timeout if it takes too long to load (15s)
            setTimeout(() => {
                audio.removeEventListener("canplaythrough", onCanPlayThrough);
                audio.removeEventListener("error", onError);
                if (trackIdRef.current === trackId && state.loadingTrackId === trackId) {
                   reject(new Error("Loading timeout"));
                }
            }, 15000);
        });
    }, [state.loadingTrackId]);

    const play = useCallback(
        async (trackId: string, source: string) => {
            if (trackIdRef.current === trackId) {
                console.log("[AudioPlayer] Stopping track:", trackId);
                stopInternal();
                return;
            }

            releaseAudio();
            trackIdRef.current = trackId;
            setState({ playingTrackId: null, loadingTrackId: trackId });

            console.log("[AudioPlayer] Starting playback for:", trackId, "Source type:", isLocalPath(source) ? "local" : "remote");

            try {
                // Path A: Local Files -> Native Rust (Maximum stability on Linux)
                if (isLocalPath(source)) {
                    console.log("[AudioPlayer] Playing local file via Native Rust engine:", source);
                    await invoke("play_audio_native", { path: source });
                    if (trackIdRef.current === trackId) {
                        setState({ playingTrackId: trackId, loadingTrackId: null });
                    }
                    return;
                }

                // Path B: Remote URLs -> Browser Audio
                if (source.startsWith("http")) {
                    console.log("[AudioPlayer] Playing remote URL via Browser engine:", source);
                    await attemptPlay(trackId, source);
                    return;
                }

                throw new Error("Unsupported audio source: " + source);

            } catch (err) {
                console.error("[AudioPlayer] Playback failed:", err);
                if (trackIdRef.current === trackId) {
                    releaseAudio();
                    setState({ playingTrackId: null, loadingTrackId: null });
                }
            }
        },
        [stopInternal, releaseAudio, attemptPlay]
    );

    const isPlaying = useCallback(
        (trackId: string) => state.playingTrackId === trackId,
        [state.playingTrackId]
    );

    const isLoading = useCallback(
        (trackId: string) => state.loadingTrackId === trackId,
        [state.loadingTrackId]
    );

    return {
        playingTrackId: state.playingTrackId,
        loadingTrackId: state.loadingTrackId,
        play,
        stop: stopInternal,
        isPlaying,
        isLoading,
    };
}
