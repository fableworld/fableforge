import { invoke } from "@tauri-apps/api/core";

export interface SlotDto {
  index: number;
  name: string;
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
