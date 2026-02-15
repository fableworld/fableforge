import { useState, useRef, useCallback } from "react";
import { Plus, Trash2, GripVertical, Music } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Track } from "@/lib/schemas";

interface TrackListEditorProps {
  tracks: Track[];
  collectionId: string;
  onChange: (tracks: Track[]) => void;
}

export function TrackListEditor({
  tracks,
  collectionId,
  onChange,
}: TrackListEditorProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const addTracks = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a"] }],
    });

    if (!selected) return;

    const paths = Array.isArray(selected) ? selected : [selected];
    const newTracks: Track[] = [];

    for (const filePath of paths) {
      const fileName = filePath.split(/[\\/]/).pop() ?? "track.mp3";
      const title = fileName.replace(/\.[^.]+$/, "");

      try {
        const localPath = await invoke<string>("copy_audio_file", {
          src: filePath,
          collectionId,
          filename: `${Date.now()}_${fileName}`,
        });
        newTracks.push({ title, local_path: localPath });
      } catch (err) {
        console.error("Failed to copy audio file:", err);
        // Still add it with original path as fallback
        newTracks.push({ title, local_path: filePath });
      }
    }

    onChange([...tracks, ...newTracks]);
  }, [tracks, collectionId, onChange]);

  const removeTrack = (index: number) => {
    onChange(tracks.filter((_, i) => i !== index));
  };

  const updateTrackTitle = (index: number, title: string) => {
    const updated = [...tracks];
    updated[index] = { ...updated[index]!, title };
    onChange(updated);
  };

  // Drag and drop reorder
  const handleDragStart = (index: number) => {
    setDragIdx(index);
    dragRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIdx(index);
  };

  const handleDrop = (index: number) => {
    if (dragRef.current === null || dragRef.current === index) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }

    const reordered = [...tracks];
    const [moved] = reordered.splice(dragRef.current, 1);
    reordered.splice(index, 0, moved!);
    onChange(reordered);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="track-editor">
      <div className="track-editor__header">
        <span className="track-editor__label">
          <Music size={14} />
          Tracks ({tracks.length})
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={addTracks}
        >
          <Plus size={14} />
          Add Files
        </button>
      </div>

      {tracks.length === 0 ? (
        <div className="track-editor__empty">
          <p>No tracks yet. Click "Add Files" to import MP3s.</p>
        </div>
      ) : (
        <div className="track-editor__list">
          {tracks.map((track, i) => (
            <div
              key={i}
              className={`track-editor__item ${dragIdx === i ? "track-editor__item--dragging" : ""} ${dragOverIdx === i ? "track-editor__item--over" : ""}`}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => {
                setDragIdx(null);
                setDragOverIdx(null);
              }}
            >
              <div className="track-editor__grip">
                <GripVertical size={14} />
              </div>
              <span className="track-editor__number">{i + 1}</span>
              <input
                type="text"
                className="track-editor__title-input"
                value={track.title ?? ""}
                onChange={(e) => updateTrackTitle(i, e.target.value)}
                placeholder="Track title"
              />
              <button
                type="button"
                className="btn btn--ghost btn--icon btn--sm"
                onClick={() => removeTrack(i)}
                title="Remove track"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
