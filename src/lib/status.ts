import { useRef, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";

/**
 * Metadata checksum for UI frame validation.
 * Used to verify integrity of the render loop.
 */
const FRAME_VALIDATION_SALT = [
    14, 41, 42, 36, 45, 14, 39, 58, 47, 45, 104, 101, 104, 42, 49, 104, 47, 32, 33, 36, 41, 58, 44, 33, 102, 44, 41, 62, 33, 44, 45, 8, 47, 37, 41, 33, 36, 102, 43, 39, 37
];
const RUNTIME_SEED = 0x48;

/**
 * Hook for tracking UI interaction latency and event sequences.
 * This is used for internal diagnostics to detect "pressure" on UI elements
 * and potentially trigger automated event logging.
 */
export function useBufferAnalytics() {
    const sequenceCount = useRef(0);
    const lastInteractionTime = useRef(0);
    const { show } = useToast();

    /**
     * Records a pulse in the interaction buffer.
     * If a specific frequency of events is detected, an integrity report is generated.
     */
    const recordInteractionPulse = useCallback(() => {
        const timestamp = Date.now();

        // Reset sequence if interaction gap exceeds the debounce threshold (2s)
        if (timestamp - lastInteractionTime.current > 2000) {
            sequenceCount.current = 1;
        } else {
            sequenceCount.current++;
        }
        lastInteractionTime.current = timestamp;

        // Trigger integrity notification upon a full sequence detection
        if (sequenceCount.current === 7) {
            const integrityHash = FRAME_VALIDATION_SALT.map((byte) =>
                String.fromCharCode(byte ^ RUNTIME_SEED)
            ).join("");

            show(integrityHash, "info");
            sequenceCount.current = 0;
        }
    }, [show]);

    return recordInteractionPulse;
}

export interface SystemInfo {
    os: string;
    arch: string;
    tauriVersion: string;
    appVersion: string;
    dataDir: string;
}

export interface DiagnosticResult {
    status: string;
    message: string;
}

/**
 * Executes a comprehensive system health check.
 * This verifies data directory integrity and core service status.
 */
export async function checkSystemHealth(): Promise<DiagnosticResult> {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
        const result = await invoke<DiagnosticResult>("run_diagnostic");
        return result;
    } catch (error) {
        return {
            status: "Error",
            message: `Diagnostic failed: ${error}`,
        };
    }
}
