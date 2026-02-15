import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAtom, useSetAtom } from "jotai";
import {
  ArrowLeft,
  Music,
  Box,
  ExternalLink,
  ImageOff,
  Upload,
} from "lucide-react";
import { charactersAtom } from "@/stores/registries";
import { registryService } from "@/services/registry";
import { deviceStatusAtom, writeProgressAtom } from "@/stores/device";
import { deviceService } from "@/services/device";
import { SlotSelectionDialog } from "@/components/SlotSelectionDialog";
import { WriteProgressDialog } from "@/components/WriteProgressDialog";
import { OverwriteConfirmDialog } from "@/components/OverwriteConfirmDialog";
import type { Character } from "@/lib/schemas";
import type { SlotInfo, WriteProgress } from "@/stores/device";

export function CharacterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [characters] = useAtom(charactersAtom);
  const setCharacters = useSetAtom(charactersAtom);
  const [device] = useAtom(deviceStatusAtom);
  const [character, setCharacter] = useState<Character | undefined>();

  // Write flow state
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progress, setProgress] = useAtom(writeProgressAtom);

  const loadIfNeeded = useCallback(async () => {
    if (characters.length === 0) {
      const data = await registryService.loadAll();
      setCharacters(data.characters);
    }
  }, [characters.length, setCharacters]);

  useEffect(() => {
    loadIfNeeded();
  }, [loadIfNeeded]);

  useEffect(() => {
    if (id && characters.length > 0) {
      setCharacter(characters.find((c) => c.id === id));
    }
  }, [id, characters]);

  // Listen for write progress events
  useEffect(() => {
    const unlisten = deviceService.onWriteProgress((p: WriteProgress) => {
      setProgress(p);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setProgress]);

  const handleWriteToDevice = async () => {
    if (!device.connected) return;
    setSlotsLoading(true);
    setSlotDialogOpen(true);
    try {
      const deviceSlots = await deviceService.getSlots();
      setSlots(deviceSlots);
    } catch (err) {
      console.error("Failed to load slots:", err);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSlotSelected = (slotIndex: number) => {
    const slot = slots.find((s) => s.index === slotIndex);
    if (!slot) return;
    setSelectedSlot(slot);
    setSlotDialogOpen(false);

    if (slot.exists && slot.trackCount > 0) {
      setOverwriteDialogOpen(true);
    } else {
      startWrite(slotIndex);
    }
  };

  const startWrite = async (slotIndex: number) => {
    if (!character) return;
    setOverwriteDialogOpen(false);
    setProgress({ current: 0, total: character.tracks.length, trackName: "", status: "writing" });
    setProgressDialogOpen(true);

    try {
      const trackPaths = character.tracks
        .map((t) => t.url)
        .filter((url): url is string => url !== undefined);
      await deviceService.writeCharacterToSlot(slotIndex, trackPaths);
    } catch (err) {
      console.error("Write failed:", err);
      setProgress((p) => ({ ...p, status: "error" }));
    }
  };

  if (!character) {
    return (
      <>
        <header className="main-content__header">
          <button className="btn btn--ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Back
          </button>
        </header>
        <div className="main-content__body">
          <div className="empty-state">
            <h2 className="empty-state__title">Character not found</h2>
            <p className="empty-state__description">
              This character may have been removed or the registry is unavailable.
            </p>
            <button className="btn btn--primary" onClick={() => navigate("/")}>
              Back to Gallery
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="main-content__header">
        <button className="btn btn--ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Write to Device button */}
        <button
          className="btn btn--primary"
          onClick={handleWriteToDevice}
          disabled={!device.connected || character.tracks.length === 0}
          title={
            !device.connected
              ? "No device connected"
              : character.tracks.length === 0
              ? "No tracks to write"
              : "Write character to device"
          }
        >
          <Upload size={16} />
          Write to Device
        </button>
      </header>

      <div className="main-content__body">
        <div className="character-detail">
          {/* Hero Image */}
          <div className="character-detail__hero">
            {character.preview_image ? (
              <img
                src={character.preview_image}
                alt={character.name}
              />
            ) : (
              <div className="character-detail__hero-placeholder">
                <ImageOff size={48} />
              </div>
            )}
          </div>

          {/* Name & Description */}
          <h1 className="character-detail__name">{character.name}</h1>
          {character.description && (
            <p className="character-detail__description">
              {character.description}
            </p>
          )}

          {/* Tracks */}
          {character.tracks.length > 0 && (
            <section className="character-detail__section">
              <h2 className="character-detail__section-title">
                <Music size={18} />
                Tracks ({character.tracks.length})
              </h2>
              <div className="track-list">
                {character.tracks.map((track, i) => (
                  <div key={i} className="track-item">
                    <span className="track-item__number">{i + 1}</span>
                    <span className="track-item__title">
                      {track.title ?? `Track ${i + 1}`}
                    </span>
                    {track.duration != null && (
                      <span className="track-item__duration">
                        {Math.floor(track.duration / 60)}:
                        {String(Math.floor(track.duration % 60)).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Audio Sample */}
          {character.audio_sample_url && (
            <section className="character-detail__section">
              <h2 className="character-detail__section-title">
                <Music size={18} />
                Audio Sample
              </h2>
              <audio
                controls
                src={character.audio_sample_url}
                style={{ width: "100%", borderRadius: "var(--radius-md)" }}
              />
            </section>
          )}

          {/* Gallery Images */}
          {character.gallery_images.length > 0 && (
            <section className="character-detail__section">
              <h2 className="character-detail__section-title">Gallery</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: "var(--space-3)",
                }}
              >
                {character.gallery_images.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`${character.name} gallery ${i + 1}`}
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      objectFit: "cover",
                      borderRadius: "var(--radius-md)",
                    }}
                    loading="lazy"
                  />
                ))}
              </div>
            </section>
          )}

          {/* 3D Models */}
          {character.models_3d.length > 0 && (
            <section className="character-detail__section">
              <h2 className="character-detail__section-title">
                <Box size={18} />
                3D Models
              </h2>
              <div className="model-links">
                {character.models_3d.map((model, i) => (
                  <a
                    key={i}
                    href={model.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="model-link"
                  >
                    <ExternalLink size={14} />
                    {model.provider.charAt(0).toUpperCase() +
                      model.provider.slice(1)}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Device Address */}
          {character.device_address != null && (
            <section className="character-detail__section">
              <h2 className="character-detail__section-title">Device</h2>
              <div className="badge badge--primary">
                Slot {character.device_address}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* --- Write-to-device dialogs --- */}
      <SlotSelectionDialog
        open={slotDialogOpen}
        onOpenChange={setSlotDialogOpen}
        slots={slots}
        suggestedSlot={character.device_address}
        onSelectSlot={handleSlotSelected}
        loading={slotsLoading}
      />

      {selectedSlot && (
        <OverwriteConfirmDialog
          open={overwriteDialogOpen}
          onOpenChange={setOverwriteDialogOpen}
          slotIndex={selectedSlot.index}
          currentName={selectedSlot.name}
          currentTrackCount={selectedSlot.trackCount}
          newCharacterName={character.name}
          onOverwrite={() => startWrite(selectedSlot.index)}
          onChangeSlot={() => {
            setOverwriteDialogOpen(false);
            setSlotDialogOpen(true);
          }}
        />
      )}

      <WriteProgressDialog
        open={progressDialogOpen}
        onOpenChange={setProgressDialogOpen}
        progress={progress}
        onRetry={selectedSlot ? () => startWrite(selectedSlot.index) : undefined}
      />
    </>
  );
}
