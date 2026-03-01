import { useState, useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import { deviceService, SlotCheckResult } from "@/services/device";
import { deviceSlotsAtom, writeProgressAtom } from "@/stores/device";
import { SlotSelectionDialog } from "./SlotSelectionDialog";
import { WriteProgressDialog } from "./WriteProgressDialog";
import { OverwriteConfirmDialog } from "./OverwriteConfirmDialog";

interface CharacterData {
  id: string;
  name: string;
  description?: string;
  previewImageUrl?: string;
  registryUrl?: string;
  registryName?: string;
  tracks: string[];
  contentHash?: string;
}

interface WriteFlowOrchestratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: CharacterData;
}

type FlowStep =
  | "idle"
  | "finding_slot"
  | "checking_slot"
  | "confirm_overwrite"
  | "writing"
  | "done";

export function WriteFlowOrchestrator({
  open,
  onOpenChange,
  character,
}: WriteFlowOrchestratorProps) {
  const [step, setStep] = useState<FlowStep>("idle");
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [slots] = useAtom(deviceSlotsAtom);
  const setSlots = useSetAtom(deviceSlotsAtom);
  const [progress, setProgress] = useAtom(writeProgressAtom);
  const [suggestedSlot, setSuggestedSlot] = useState<number | null>(null);
  const [slotCheck, setSlotCheck] = useState<SlotCheckResult | null>(null);
  const [lastNfcPayload, setLastNfcPayload] = useState<string | null>(null);

  // Step 0: Listen for write progress events
  useEffect(() => {
    const unlisten = deviceService.onWriteProgress((p) => {
      setProgress(p);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setProgress]);

  // Step 0.5: Ensure slots are loaded
  useEffect(() => {
    if (open && slots.length === 0) {
      deviceService.getSlots()
        .then(setSlots)
        .catch(console.error);
    }
  }, [open, slots.length, setSlots]);

  // Step 1: Initializing - find character if already on device
  useEffect(() => {
    if (open && step === "idle") {
      setStep("finding_slot");
      if (character.registryUrl) {
        deviceService
          .checkCharacterOnDevice({
            registryUrl: character.registryUrl,
            characterId: character.id,
          })
          .then((found) => {
            if (found) {
              setSuggestedSlot(found.slotIndex);
            }
          })
          .catch(console.error);
      }
    }
  }, [open, step, character]);

  const handleSelectSlot = async (slot: number) => {
    setSelectedSlot(slot);
    setStep("checking_slot");

    try {
      const result = await deviceService.checkSlotStatus({
        slotIndex: slot,
        registryUrl: character.registryUrl || "",
        characterId: character.id,
        contentHash: character.contentHash,
      });

      setSlotCheck(result);

      if (result.type === "empty") {
        startWrite(slot);
      } else {
        setStep("confirm_overwrite");
      }
    } catch (error) {
      console.error("Error checking slot status:", error);
      // Fallback: just show overwrite dialog if check fails
      setStep("confirm_overwrite");
    }
  };

  const startWrite = async (slot: number) => {
    setStep("writing");
    setProgress({
      current: 0,
      total: character.tracks.length,
      trackName: "",
      status: "encoding",
    });

    try {
      const nfcPayload = await deviceService.writeCharacterToSlot({
        slot,
        tracks: character.tracks,
        characterId: character.id,
        characterName: character.name,
        description: character.description,
        previewImageUrl: character.previewImageUrl,
        registryUrl: character.registryUrl,
        registryName: character.registryName,
        contentHash: character.contentHash,
      });
      setLastNfcPayload(nfcPayload);
      // Success is handled via onWriteProgress listener usually, 
      // but writeCharacterToSlot returns when done.
    } catch (error) {
      console.error("Write error:", error);
      setProgress((prev) => ({ ...prev, status: "error" }));
    }
  };

  const handleClose = () => {
    setStep("idle");
    setSelectedSlot(null);
    setSlotCheck(null);
    onOpenChange(false);
  };

  return (
    <>
      {/* Step 1: Slot Selection */}
      <SlotSelectionDialog
        open={open && (step === "finding_slot" || step === "checking_slot")}
        onOpenChange={(isOpen) => !isOpen && handleClose()}
        slots={slots}
        suggestedSlot={suggestedSlot || undefined}
        onSelectSlot={handleSelectSlot}
        loading={step === "checking_slot"}
      />

      {/* Step 2: Overwrite Confirmation */}
      {selectedSlot !== null && slotCheck && (
        <OverwriteConfirmDialog
          open={step === "confirm_overwrite"}
          onOpenChange={(isOpen) => !isOpen && setStep("finding_slot")}
          slotIndex={selectedSlot}
          checkResult={slotCheck}
          onConfirm={() => startWrite(selectedSlot)}
        />
      )}

      {/* Step 3: Progress & Results */}
      <WriteProgressDialog
        open={step === "writing" || (step === "done" && progress.status === "done")}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleClose();
        }}
        progress={progress}
        nfcPayload={lastNfcPayload || undefined}
        onRetry={() => selectedSlot !== null && startWrite(selectedSlot)}
      />
    </>
  );
}
