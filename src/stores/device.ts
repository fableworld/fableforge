import { atom } from "jotai";

export interface DeviceStatus {
  connected: boolean;
  mountpoint?: string;
}

export const deviceStatusAtom = atom<DeviceStatus>({ connected: false });
