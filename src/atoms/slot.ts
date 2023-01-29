import { atom } from "jotai";

interface FabaSlot {
    index: number,
    name: string,
};

export const selectedSlotAtom = atom<FabaSlot | null>(null);