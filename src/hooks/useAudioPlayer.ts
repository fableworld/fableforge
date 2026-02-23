import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

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
 * Determine the MIME type from a file extension.
 */
function getMimeType(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    switch (ext) {
        case "mp3": return "audio/mpeg";
        case "wav": return "audio/wav";
        case "ogg": return "audio/ogg";
        case "m4a": return "audio/mp4";
        case "flac": return "audio/flac";
        case "aac": return "audio/aac";
        default: return "audio/mpeg";
    }
}

/**
 * Determine if a source is a local file path (not http/https).
 */
function isLocalPath(source: string): boolean {
    return !source.startsWith("http://") && !source.startsWith("https://");
}

/**
 * For local files: read via Tauri invoke and create a Blob URL.
 * This is needed on Linux (WebKitGTK) where asset:// doesn't work
 * with HTMLAudioElement.
 * For remote URLs: use directly (streaming).
 */
async function resolveAudioSrc(source: string): Promise<string> {
    if (!isLocalPath(source)) {
        return source;
    }
    const bytes = await invoke<number[]>("read_audio_file", { path: source });
    const uint8 = new Uint8Array(bytes);
    const mimeType = getMimeType(source);
    const blob = new Blob([uint8], { type: mimeType });
    return URL.createObjectURL(blob);
}

/**
 * Custom hook for audio playback.
 *
 * - Manages a singleton HTMLAudioElement
 * - Only one track plays at a time
 * - Automatically stops on route change
 * - Local files: read via Tauri → Blob URL (WebKitGTK workaround)
 * - Remote URLs: direct streaming
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

    // Revoke current Blob URL and release audio resources
    const releaseAudio = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.removeAttribute("src");
        }
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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            releaseAudio();
        };
    }, [releaseAudio]);

    const play = useCallback(
        (trackId: string, source: string) => {
            // Toggle off if same track is playing/loading
            if (trackIdRef.current === trackId) {
                stopInternal();
                return;
            }

            // Stop any current playback
            releaseAudio();

            // Create audio element if needed
            if (!audioRef.current) {
                audioRef.current = new Audio();
            }
            const audio = audioRef.current;

            // Mark as loading
            trackIdRef.current = trackId;
            setState({ playingTrackId: null, loadingTrackId: trackId });

            resolveAudioSrc(source)
                .then((src) => {
                    // If another track was selected while we were loading, bail out
                    if (trackIdRef.current !== trackId) {
                        // Clean up blob URL we just created (if any)
                        if (isLocalPath(source)) URL.revokeObjectURL(src);
                        return;
                    }

                    // Store blob URL for later cleanup
                    if (isLocalPath(source)) {
                        blobUrlRef.current = src;
                    }

                    audio.src = src;

                    audio.onended = () => {
                        trackIdRef.current = null;
                        if (blobUrlRef.current) {
                            URL.revokeObjectURL(blobUrlRef.current);
                            blobUrlRef.current = null;
                        }
                        setState({ playingTrackId: null, loadingTrackId: null });
                    };

                    audio.onerror = (e) => {
                        console.error("Audio error for track:", trackId, e);
                        trackIdRef.current = null;
                        if (blobUrlRef.current) {
                            URL.revokeObjectURL(blobUrlRef.current);
                            blobUrlRef.current = null;
                        }
                        setState({ playingTrackId: null, loadingTrackId: null });
                    };

                    audio
                        .play()
                        .then(() => {
                            if (trackIdRef.current === trackId) {
                                setState({ playingTrackId: trackId, loadingTrackId: null });
                            }
                        })
                        .catch((err) => {
                            console.error("Audio play() rejected:", err);
                            if (trackIdRef.current === trackId) {
                                releaseAudio();
                                setState({ playingTrackId: null, loadingTrackId: null });
                            }
                        });
                })
                .catch((err) => {
                    console.error("Failed to resolve audio source:", err);
                    if (trackIdRef.current === trackId) {
                        trackIdRef.current = null;
                        setState({ playingTrackId: null, loadingTrackId: null });
                    }
                });
        },
        [stopInternal, releaseAudio]
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
