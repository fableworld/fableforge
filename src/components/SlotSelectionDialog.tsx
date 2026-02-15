import { useState, useEffect, useMemo, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Search, HardDrive, Music } from "lucide-react";
import type { SlotInfo } from "@/stores/device";

interface SlotSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: SlotInfo[];
  suggestedSlot?: number;
  onSelectSlot: (slot: number) => void;
  loading?: boolean;
}

export function SlotSelectionDialog({
  open,
  onOpenChange,
  slots,
  suggestedSlot,
  onSelectSlot,
  loading,
}: SlotSelectionDialogProps) {
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  // Scroll to suggested slot when dialog opens
  useEffect(() => {
    if (open && suggestedSlot && listRef.current) {
      const timer = setTimeout(() => {
        const el = listRef.current?.querySelector(
          `[data-slot="${suggestedSlot}"]`
        );
        el?.scrollIntoView({ block: "center" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, suggestedSlot]);

  const filteredSlots = useMemo(() => {
    if (!search) return slots;
    const q = search.toLowerCase();
    return slots.filter(
      (s) =>
        s.index.toString().includes(q) ||
        s.name.toLowerCase().includes(q)
    );
  }, [slots, search]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content dialog-content--wide">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              <HardDrive size={18} />
              Select Slot
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn btn--ghost btn--icon btn--sm">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="dialog-description">
            Choose a slot on the device to write this character to.
          </Dialog.Description>

          {/* Search */}
          <div className="slot-search">
            <Search size={14} />
            <input
              type="text"
              className="slot-search__input"
              placeholder="Search by slot number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Slot list */}
          {loading ? (
            <div className="slot-list__loading">Loading slots...</div>
          ) : (
            <div className="slot-list" ref={listRef}>
              {filteredSlots.map((slot) => (
                <button
                  key={slot.index}
                  data-slot={slot.index}
                  className={`slot-list__item ${
                    suggestedSlot === slot.index
                      ? "slot-list__item--suggested"
                      : ""
                  } ${slot.exists && slot.trackCount > 0 ? "slot-list__item--occupied" : ""}`}
                  onClick={() => onSelectSlot(slot.index)}
                >
                  <span className="slot-list__index">{slot.index}</span>
                  <span className="slot-list__name">
                    {slot.exists && slot.trackCount > 0
                      ? slot.name
                      : "Empty"}
                  </span>
                  {slot.trackCount > 0 && (
                    <span className="slot-list__tracks">
                      <Music size={10} />
                      {slot.trackCount}
                    </span>
                  )}
                  {suggestedSlot === slot.index && (
                    <span className="slot-list__badge">Suggested</span>
                  )}
                </button>
              ))}
              {filteredSlots.length === 0 && (
                <div className="slot-list__empty">No matching slots</div>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
