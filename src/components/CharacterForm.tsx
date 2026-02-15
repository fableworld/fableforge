import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Save, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { TrackListEditor } from "@/components/TrackListEditor";
import type { Character, Track } from "@/lib/schemas";

interface CharacterFormProps {
  character: Character;
  collectionId: string;
  onSave: (character: Character) => void;
  onCancel: () => void;
}

export function CharacterForm({
  character,
  collectionId,
  onSave,
  onCancel,
}: CharacterFormProps) {
  const [name, setName] = useState(character.name);
  const [description, setDescription] = useState(character.description ?? "");
  const [previewImage, setPreviewImage] = useState(character.preview_image ?? "");
  const [deviceAddress, setDeviceAddress] = useState<number | "">(
    character.device_address ?? ""
  );
  const [tracks, setTracks] = useState<Track[]>(character.tracks);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  useEffect(() => {
    setName(character.name);
    setDescription(character.description ?? "");
    setPreviewImage(character.preview_image ?? "");
    setDeviceAddress(character.device_address ?? "");
    setTracks(character.tracks);
  }, [character]);

  const handlePickImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "webp", "gif"],
          },
        ],
      });

      if (selected && !Array.isArray(selected)) {
        setIsProcessingImage(true);
        const processedPath = await invoke<string>("process_and_save_image", {
          srcPath: selected,
          collectionId,
          characterId: character.id,
        });
        console.log("Processed image path:", processedPath);
        setPreviewImage(processedPath);
      }
    } catch (err) {
      console.error("Failed to process image:", err);
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...character,
      name: name.trim(),
      description: description.trim() || undefined,
      preview_image: previewImage.trim() || undefined,
      device_address: deviceAddress === "" ? undefined : deviceAddress,
      tracks,
    });
  };

  // Helper to get image src
  const getImageSrc = (path: string) => {
    if (!path) return "/logo.png";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
      return path;
    }
    // Local path
    return convertFileSrc(path);
  };

  return (
    <form className="character-form" onSubmit={handleSubmit}>
      <div className="character-form__header">
        <h2 className="character-form__title">Edit Character</h2>
        <div className="character-form__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onCancel}
          >
            <X size={14} />
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary btn--sm"
            disabled={!name.trim() || isProcessingImage}
          >
            <Save size={14} />
            Save
          </button>
        </div>
      </div>

      <div className="character-form__body">
        {/* Preview & Image Picker */}
        <div className="form-group">
          <label className="form-label">Preview Image</label>
          <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
            <div 
              style={{ 
                width: 100, 
                height: 100, 
                borderRadius: "var(--radius-md)", 
                overflow: "hidden",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-bg-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <img 
                src={getImageSrc(previewImage)} 
                alt="Preview" 
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/logo.png";
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={handlePickImage}
                disabled={isProcessingImage}
                style={{ marginBottom: "var(--space-2)" }}
              >
                {isProcessingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                Change Image
              </button>
              <p className="form-help-text" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                Selected image will be automatically resized and converted to JPEG.
              </p>
              <input
                type="text"
                className="form-input form-input--sm"
                value={previewImage}
                onChange={(e) => setPreviewImage(e.target.value)}
                placeholder="Or enter URL directly"
                style={{ marginTop: "var(--space-2)" }}
              />
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="form-group">
          <label className="form-label">Name</label>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Character name"
            required
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short description..."
            rows={3}
          />
        </div>

        {/* Device Address */}
        <div className="form-group">
          <label className="form-label">Device Address (Slot 0–499)</label>
          <input
            type="number"
            className="form-input"
            value={deviceAddress}
            onChange={(e) =>
              setDeviceAddress(
                e.target.value === "" ? "" : parseInt(e.target.value, 10)
              )
            }
            min={0}
            max={499}
            placeholder="Auto"
          />
        </div>

        {/* Tracks */}
        <TrackListEditor
          tracks={tracks}
          collectionId={collectionId}
          onChange={setTracks}
        />
      </div>
    </form>
  );
}
