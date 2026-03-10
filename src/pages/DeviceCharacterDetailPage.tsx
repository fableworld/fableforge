import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAtom } from "jotai";
import {
  ArrowLeft,
  Music,
  Play,
  Square,
  Loader2,
  Trash2,
  QrCode,
} from "lucide-react";
import { deviceStatusAtom } from "@/stores/device";
import { deviceService, type DeviceCharacterDto } from "@/services/device";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useToast } from "@/components/ToastProvider";
import { Track } from "@/lib/schemas";
import { NfcQrDialog } from "@/components/NfcQrDialog";

export function DeviceCharacterDetailPage() {
  const { slotIndex } = useParams<{ slotIndex: string }>();
  const navigate = useNavigate();
  const [device] = useAtom(deviceStatusAtom);
  const [character, setCharacter] = useState<DeviceCharacterDto | null>(null);
  const [parsedTracks, setParsedTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [nqrDialogOpen, setNqrDialogOpen] = useState(false);
  const { show: toast } = useToast();

  const audioPlayer = useAudioPlayer();

  const loadCharacter = useCallback(async () => {
    if (!device.connected || !slotIndex) return;
    setLoading(true);
    try {
      const idx = parseInt(slotIndex, 10);
      const data = await deviceService.getDeviceCharacter(idx);
      setCharacter(data);
      
      if (data && data.tracksJson) {
        try {
          const tracks = JSON.parse(data.tracksJson) as string[];
          setParsedTracks(
            tracks.map((path, i) => {
              // The Faba device stores tracks inside `MKI01/K5{slot_index_padded}` as `CP{i+1}.MKI`.
              // We construct the absolute path to the .MKI file on the device.
              const trackNum = String(i + 1).padStart(2, "0");
              const slotPadded = String(data.slotIndex).padStart(3, "0");
              let resolvedPath = path;
              if (device.mountpoint) {
                 resolvedPath = `${device.mountpoint}/MKI01/K5${slotPadded}/CP${trackNum}.MKI`.replace(/\/+/g, '/');
              } else if (!path.startsWith("/") && !path.match(/^[a-zA-Z]:/)) {
                 // Fallback if no mountpoint but we have some path
                 resolvedPath = `/${path}`;
              }

              return {
                title: `Track ${i + 1}`,
                local_path: resolvedPath,
                // Faba devices do not store duration, so we omit it
              };
            })
          );
        } catch (e) {
          console.error("Failed to parse tracks JSON", e);
        }
      }
    } catch (error) {
      console.error("Failed to load device character:", error);
      toast("Failed to load character from device.", "error");
    } finally {
      setLoading(false);
    }
  }, [device.connected, slotIndex, toast]);

  useEffect(() => {
    loadCharacter();
  }, [loadCharacter]);

  const handleDelete = async () => {
    if (!character) return;
    if (!confirm(`Are you sure you want to remove "${character.characterName}" from slot ${character.slotIndex}?`)) {
      return;
    }

    try {
      await deviceService.deleteDeviceCharacter(character.slotIndex);
      toast(`Removed "${character.characterName}"`, "success");
      navigate("/device");
    } catch (error) {
      console.error("Delete failed:", error);
      toast("Failed to remove character", "error");
    }
  };

  const getTrackSource = (track: { local_path?: string; url?: string }) =>
    track.local_path ?? track.url ?? null;

  if (!device.connected) {
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
                <h2 className="empty-state__title">No device connected</h2>
                <p className="empty-state__description">
                    Connect your FABA device via USB to manage its content.
                </p>
                </div>
            </div>
        </>
      );
  }

  if (loading) {
    return (
      <>
        <header className="main-content__header">
          <button className="btn btn--ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Back
          </button>
        </header>
        <div className="main-content__body">
          <div className="loading-grid">
             <div className="skeleton" style={{ height: "400px" }} />
          </div>
        </div>
      </>
    );
  }

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
              This slot might be empty or unavailable.
            </p>
            <button className="btn btn--primary" onClick={() => navigate("/device")}>
              Back to Device
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

        <div className="main-content__header-actions">
          {character.nfcPayload && (
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setNqrDialogOpen(true)}
              title="Show NFC QR Code"
            >
              <QrCode size={16} />
              Show NFC QR
            </button>
          )}

          <button
            className="btn btn--ghost btn--danger-hover btn--sm"
            onClick={handleDelete}
            title="Remove from device"
          >
            <Trash2 size={16} />
            Remove
          </button>
        </div>
      </header>

      <div className="main-content__body">
        <div className="character-detail">
          {/* Hero Image */}
          <div className="character-detail__hero">
            <img
              src={
                character.previewImageDataUrl
                  ? character.previewImageDataUrl
                  : character.previewImageUrl
                  ? character.previewImageUrl.startsWith("/") || character.previewImageUrl.includes(":")
                    ? character.previewImageUrl.startsWith("/") ? convertFileSrc(character.previewImageUrl) : character.previewImageUrl
                    : character.previewImageUrl
                  : "/logo.png"
              }
              alt={character.characterName}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/logo.png";
              }}
            />
          </div>

          {/* Name & Description */}
          <h1 className="character-detail__name">{character.characterName}</h1>
          {character.description && (
            <p className="character-detail__description">
              {character.description}
            </p>
          )}

          {/* Tracks */}
          {parsedTracks.length > 0 && (
            <section className="character-detail__section">
              <h2 className="character-detail__section-title">
                <Music size={18} />
                Tracks ({parsedTracks.length})
              </h2>
              <div className="track-list">
                {parsedTracks.map((track, i) => {
                  const trackId = `device-${character.slotIndex}-${i}`;
                  const source = getTrackSource(track);
                  const playing = audioPlayer.isPlaying(trackId);
                  const loading = audioPlayer.isLoading(trackId);

                  return (
                    <div
                      key={i}
                      className={`track-item ${playing ? "track-item--playing" : ""}`}
                    >
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
                      {source && (
                        <button
                          type="button"
                          className={`track-item__play-btn ${playing ? "track-item__play-btn--active" : ""}`}
                          onClick={() => audioPlayer.play(trackId, source)}
                          title={loading ? "Loading…" : playing ? "Stop" : "Play"}
                        >
                          {loading ? (
                            <Loader2 size={14} className="spin" />
                          ) : playing ? (
                            <Square size={14} />
                          ) : (
                            <Play size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Device Address */}
          <section className="character-detail__section">
            <h2 className="character-detail__section-title">Device Slot</h2>
            <div className="badge badge--primary">
              Slot {character.slotIndex}
            </div>
          </section>

          {/* Original Source */}
          {character.registryName && (
            <section className="character-detail__section">
                <h2 className="character-detail__section-title">Registry</h2>
                <div className="badge badge--secondary">
                {character.registryName}
                </div>
            </section>
          )}
        </div>
      </div>

      {character.nfcPayload && (
        <NfcQrDialog
          open={nqrDialogOpen}
          onOpenChange={setNqrDialogOpen}
          nfcPayload={character.nfcPayload}
        />
      )}
    </>
  );
}
