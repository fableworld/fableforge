import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DeviceStatus, SlotInfo, WriteProgress } from "@/stores/device";

export interface SlotDto {
  index: number;
  name: string;
  trackCount: number;
  exists: boolean;
}

export interface DeviceStatus {
  connected: boolean;
  mountpoint?: string;
}

interface DeviceStatusDto {
  connected: boolean;
  mountpoint: string | null;
}

export interface WriteProgress {
  current: number;
  total: number;
  trackName: string;
  status: "idle" | "encoding" | "writing" | "done" | "error";
}

interface WriteProgressDto {
  current: number;
  total: number;
  track_name: string;
  status: string;
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

export interface DeviceCharacterDto {
  id: number;
  slotIndex: number;
  status: string; // "writing" | "deleting" | "upgrading" | "ready"
  characterId: string;
  characterName: string;
  description: string | null;
  previewImageDataUrl: string | null;
  previewImageUrl: string | null;
  registryUrl: string | null;
  registryName: string | null;
  trackCount: number;
  tracksJson: string | null;
  nfcPayload: string | null;
  deviceAddress: number | null;
  writtenAt: string;
  updatedAt: string;
  contentHash: string | null;
}

export interface PendingOperationDto {
  id: number;
  slotIndex: number;
  operation: string; // "write" | "delete" | "upgrade"
  startedAt: string;
  characterId: string | null;
  registryUrl: string | null;
  completedTracks: number;
  totalTracks: number;
}

export type SlotCheckResult =
  | { type: "empty" }
  | {
      type: "sameCharacterSameContent";
      slotIndex: number;
      characterName: string;
      nfcPayload: string | null;
    }
  | {
      type: "sameCharacterDifferentContent";
      slotIndex: number;
      characterName: string;
    }
  | {
      type: "differentCharacter";
      slotIndex: number;
      existingCharacterName: string;
      existingCharacterId: string;
      existingRegistryUrl: string | null;
    }
  | {
      type: "inconsistent";
      slotIndex: number;
      fileCount: number;
    };

export const deviceService = {
  async checkDevice(): Promise<DeviceStatus> {
    return invoke<DeviceStatus>("check_device");
  },

  async getSlots(): Promise<SlotInfo[]> {
    return invoke<SlotInfo[]>("get_device_slots");
  },

  async writeCharacterToSlot(params: {
    slot: number;
    tracks: string[];
    characterId?: string;
    characterName?: string;
    description?: string;
    previewImageUrl?: string;
    registryUrl?: string;
    registryName?: string;
    contentHash?: string;
  }): Promise<string> {
    return invoke<string>("write_character_to_slot", params);
  },

  async checkSlotStatus(params: {
    slotIndex: number;
    registryUrl: string;
    characterId: string;
    contentHash?: string;
  }): Promise<SlotCheckResult> {
    return invoke<SlotCheckResult>("check_slot_status", params);
  },

  async checkCharacterOnDevice(params: {
    registryUrl: string;
    characterId: string;
  }): Promise<DeviceCharacterDto | null> {
    return invoke<DeviceCharacterDto | null>("check_character_on_device", params);
  },

  async deleteDeviceCharacter(slotIndex: number): Promise<void> {
    await invoke("delete_device_character", { slotIndex });
  },

  async getDeviceCharacters(): Promise<DeviceCharacterDto[]> {
    return invoke<DeviceCharacterDto[]>("get_device_characters");
  },

  async getDeviceCharacter(
    slotIndex: number
  ): Promise<DeviceCharacterDto | null> {
    return invoke<DeviceCharacterDto | null>("get_device_character", {
      slotIndex,
    });
  },

  async getPendingOperations(): Promise<PendingOperation[]> {
    return invoke<PendingOperation[]>("get_pending_operations");
  },

  async rollbackPendingOperation(opId: number, slotIndex: number): Promise<void> {
    await invoke("rollback_pending_operation", { opId, slotIndex });
  },

  async completePendingDelete(opId: number, slotIndex: number): Promise<void> {
    await invoke("complete_pending_delete", { opId, slotIndex });
  },

  onDeviceStatusChanged(callback: (status: DeviceStatus) => void) {
    return listen<DeviceStatusDto>("device-status-changed", (event) => {
      callback({
        connected: event.payload.connected,
        mountpoint: event.payload.mountpoint || undefined,
      });
    });
  },

  onWriteProgress(callback: (progress: WriteProgress) => void) {
    return listen<WriteProgressDto>("write-progress", (event) => {
      callback({
        current: event.payload.current,
        total: event.payload.total,
        trackName: event.payload.track_name,
        status: event.payload.status as any,
      });
    });
  },
};

export interface PendingOperation {
  id: number;
  slotIndex: number;
  operation: "write" | "delete" | "upgrade";
  startedAt: string;
  characterId?: string;
  registryUrl?: string;
  completedTracks: number;
  totalTracks: number;
}
