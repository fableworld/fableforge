import { atom } from "jotai";

export interface DeviceStatus {
  connected: boolean;
  mountpoint?: string;
}

export interface SlotInfo {
  index: number;
  name: string;
  trackCount: number;
  exists: boolean;
}

export interface WriteProgress {
  current: number;
  total: number;
  trackName: string;
  status: "idle" | "writing" | "done" | "error";
}

export const deviceStatusAtom = atom<DeviceStatus>({ connected: false });

export const deviceSlotsAtom = atom<SlotInfo[]>([]);

export const writeProgressAtom = atom<WriteProgress>({
  current: 0,
  total: 0,
  trackName: "",
  status: "idle",
});
