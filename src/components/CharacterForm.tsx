import { useState, useEffect } from "react";
import { Save, X } from "lucide-react";
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

  useEffect(() => {
    setName(character.name);
    setDescription(character.description ?? "");
    setPreviewImage(character.preview_image ?? "");
    setDeviceAddress(character.device_address ?? "");
    setTracks(character.tracks);
  }, [character]);

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
            disabled={!name.trim()}
          >
            <Save size={14} />
            Save
          </button>
        </div>
      </div>

      <div className="character-form__body">
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

        {/* Preview Image */}
        <div className="form-group">
          <label className="form-label">Preview Image URL</label>
          <input
            type="text"
            className="form-input"
            value={previewImage}
            onChange={(e) => setPreviewImage(e.target.value)}
            placeholder="https://example.com/image.png"
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
