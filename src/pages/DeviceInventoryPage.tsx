import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { Smartphone, Trash2, HardDrive, RefreshCw } from "lucide-react";
import { deviceStatusAtom, deviceSlotsAtom } from "@/stores/device";
import { deviceService } from "@/services/device";
import { useToast } from "@/components/ToastProvider";

export function DeviceInventoryPage() {
  const [device] = useAtom(deviceStatusAtom);
  const [slots, setSlots] = useAtom(deviceSlotsAtom);
  const [loading, setLoading] = useState(false);
  const { show: toast } = useToast();

  const loadSlots = async () => {
    if (!device.connected) return;
    setLoading(true);
    try {
      const data = await deviceService.getSlots();
      setSlots(data);
    } catch (error) {
      console.error("Failed to load device slots:", error);
      toast("Failed to load device content", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (device.connected) {
      loadSlots();
    } else {
      setSlots([]);
    }
  }, [device.connected]);

  const handleDelete = async (slotIndex: number, characterName: string) => {
    if (!confirm(`Are you sure you want to remove "${characterName}" from slot ${slotIndex + 1}?`)) {
      return;
    }

    try {
      await deviceService.deleteDeviceCharacter(slotIndex);
      toast(`Removed "${characterName}"`, "success");
      loadSlots(); // Refresh
    } catch (error) {
      console.error("Delete failed:", error);
      toast("Failed to remove character", "error");
    }
  };

  const occupiedSlots = slots.filter((s) => s.exists);

  return (
    <>
      <header className="main-content__header">
        <h1 className="main-content__title">Device Inventory</h1>
        <div className="main-content__header-actions">
          <button 
            className="btn btn--secondary btn--sm" 
            onClick={loadSlots}
            disabled={!device.connected || loading}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      <div className="main-content__body">
        {!device.connected ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <Smartphone size={32} />
            </div>
            <h2 className="empty-state__title">No device connected</h2>
            <p className="empty-state__description">
              Connect your FABA device via USB to manage its content.
            </p>
          </div>
        ) : loading && slots.length === 0 ? (
          <div className="loading-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "120px" }} />
            ))}
          </div>
        ) : occupiedSlots.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <HardDrive size={32} />
            </div>
            <h2 className="empty-state__title">Your device is empty</h2>
            <p className="empty-state__description">
              Go to the Gallery to start writing characters to your device.
            </p>
          </div>
        ) : (
          <div className="inventory-grid">
            {occupiedSlots.map((slot) => (
              <div key={slot.index} className="card inventory-item">
                <div className="inventory-item__info">
                  <div className="inventory-item__slot-badge">
                    Slot {slot.index + 1}
                  </div>
                  <h3 className="inventory-item__name">{slot.characterName || "Unknown Character"}</h3>
                  <div className="inventory-item__meta">
                    {slot.trackCount} track{slot.trackCount !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="inventory-item__actions">
                  <button
                    className="btn btn--ghost btn--icon btn--sm btn--danger-hover"
                    onClick={() => handleDelete(slot.index, slot.characterName || "Unknown")}
                    title="Remove from device"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
