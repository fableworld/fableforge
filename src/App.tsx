import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useAtom } from "jotai";
import { themeAtom } from "@/stores/theme";
import { Sidebar } from "@/components/Sidebar";
import { GalleryPage } from "@/pages/GalleryPage";
import { CollectionsPage } from "@/pages/CollectionsPage";
import { EditorPage } from "@/pages/EditorPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { CharacterDetailPage } from "@/pages/CharacterDetailPage";
import { DeviceInventoryPage } from "@/pages/DeviceInventoryPage";

import { ToastProvider } from "@/components/ToastProvider";
import { RecoveryDialog } from "@/components/RecoveryDialog";
import { DeepLinkResolver } from "@/components/DeepLinkResolver";
import { useDeepLinkListener } from "@/hooks/useDeepLinkListener";
import { deviceService, type PendingOperation } from "@/services/device";
import { useState } from "react";
import { useSetAtom } from "jotai";
import { deviceStatusAtom, deviceSlotsAtom } from "@/stores/device";

export function App() {
  const [theme] = useAtom(themeAtom);
  const [pendingOps, setPendingOps] = useState<PendingOperation[]>([]);
  const setDevice = useSetAtom(deviceStatusAtom);
  const setSlots = useSetAtom(deviceSlotsAtom);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Deep link listener (cold start + warm start)
  useDeepLinkListener();

  // Recovery & Device detection
  useEffect(() => {
    const checkRecovery = async () => {
      try {
        const ops = await deviceService.getPendingOperations();
        setPendingOps(ops);
      } catch (e) {
        console.error("Failed to check recovery:", e);
      }
    };

    const loadSlots = async () => {
      try {
        const slots = await deviceService.getSlots();
        setSlots(slots);
      } catch (e) {
        console.error("Failed to load slots:", e);
      }
    };

    // Initial check
    deviceService.checkDevice().then((status) => {
      setDevice(status);
      if (status.connected) {
        checkRecovery();
        loadSlots();
      }
    }).catch(() => {});

    // Listen for changes
    const unlisten = deviceService.onDeviceStatusChanged((status) => {
      setDevice(status);
      if (status.connected) {
        checkRecovery();
        loadSlots();
      } else {
        setPendingOps([]);
        setSlots([]);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setDevice, setSlots]);

  const handleRecoveryResolved = async () => {
    // Refresh the list
    try {
      const ops = await deviceService.getPendingOperations();
      setPendingOps(ops);
    } catch (e) {
      setPendingOps([]);
    }
  };

  return (
    <ToastProvider>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<GalleryPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/editor/:collectionId" element={<EditorPage />} />
            <Route path="/editor/:collectionId/:characterId" element={<EditorPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/device" element={<DeviceInventoryPage />} />
            <Route path="/character/:id" element={<CharacterDetailPage />} />
          </Routes>
        </main>
        <RecoveryDialog 
          operations={pendingOps} 
          onResolved={handleRecoveryResolved} 
        />
        <DeepLinkResolver />
      </div>
    </ToastProvider>
  );
}
