import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAtom, useSetAtom } from "jotai";
import {
  ArrowLeft,
  Music,
  Box,
  ExternalLink,
  Upload,
  Play,
  Square,
  Loader2,
} from "lucide-react";
import { charactersAtom } from "@/stores/registries";
import { registryService } from "@/services/registry";
import { deviceStatusAtom } from "@/stores/device";
import { WriteFlowOrchestrator } from "@/components/WriteFlowOrchestrator";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { Character } from "@/lib/schemas";

export function CharacterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [characters] = useAtom(charactersAtom);
  const setCharacters = useSetAtom(charactersAtom);
  const [device] = useAtom(deviceStatusAtom);
  const [character, setCharacter] = useState<Character | undefined>();

  // Write flow state
  const [writeFlowOpen, setWriteFlowOpen] = useState(false);

  // Audio playback
  const audioPlayer = useAudioPlayer();

  const getTrackSource = (track: { local_path?: string; url?: string }) =>
    track.local_path ?? track.url ?? null;

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



  const handleWriteToDevice = () => {
    if (!device.connected) return;
    setWriteFlowOpen(true);
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
            <img
              src={
                character.preview_image
                  ? character.preview_image.startsWith("/") || character.preview_image.includes(":")
                    ? character.preview_image.startsWith("/") ? convertFileSrc(character.preview_image) : character.preview_image
                    : character.preview_image
                  : "/logo.png"
              }
              alt={character.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/logo.png";
              }}
            />
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
                {character.tracks.map((track, i) => {
                  const trackId = `${character.id}-${i}`;
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

      {/* Write Flow Orchestrator */}
      <WriteFlowOrchestrator
        open={writeFlowOpen}
        onOpenChange={setWriteFlowOpen}
        character={{
          id: character.id,
          name: character.name,
          description: character.description,
          previewImageUrl: character.preview_image,
          registryUrl: character.registry_url,
          tracks: character.tracks
            .map((t) => t.local_path || t.url)
            .filter((p): p is string => p !== undefined),
        }}
      />
    </>
  );
}
