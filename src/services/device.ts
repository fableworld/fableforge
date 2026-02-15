import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DeviceStatus, SlotInfo, WriteProgress } from "@/stores/device";

export interface SlotDto {
  index: number;
  name: string;
  trackCount: number;
  exists: boolean;
}

export interface TrackDto {
  trackNumber: number;
}

export interface NewTrackDto {
  trackNumber: number;
  path: string;
}

export async function loadSlots(): Promise<SlotDto[]> {
  return invoke<SlotDto[]>("load_slots");
}

export async function loadTracks(slot: number): Promise<TrackDto[]> {
  return invoke<TrackDto[]>("load_tracks", { slot });
}

export async function writeTracks(
  slot: number,
  newTracks: NewTrackDto[]
): Promise<void> {
  return invoke("write_tracks", { slot, newTracks });
}

// --- Phase 3: Device management ---

export const deviceService = {
  async checkDevice(): Promise<DeviceStatus> {
    return invoke<DeviceStatus>("check_device");
  },

  async getSlots(): Promise<SlotInfo[]> {
    return invoke<SlotInfo[]>("get_device_slots");
  },

  async writeCharacterToSlot(
    slot: number,
    trackPaths: string[]
  ): Promise<void> {
    return invoke("write_character_to_slot", { slot, tracks: trackPaths });
  },

  onDeviceStatusChanged(callback: (status: DeviceStatus) => void) {
    return listen<DeviceStatus>("device-status-changed", (event) => {
      callback(event.payload);
    });
  },

  onWriteProgress(callback: (progress: WriteProgress) => void) {
    return listen<WriteProgress>("write-progress", (event) => {
      callback(event.payload);
    });
  },
};
