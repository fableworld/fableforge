import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { Plus, ArrowLeft, Users, Trash2 } from "lucide-react";
import { collectionsAtom } from "@/stores/collections";
import { createEmptyCharacter } from "@/stores/collections";
import {
  getCollectionById,
  saveCollection,
  getCollections,
} from "@/lib/store";
import { CharacterForm } from "@/components/CharacterForm";
import type { Character, Collection } from "@/lib/schemas";

export function EditorPage() {
  const { collectionId, characterId } = useParams<{
    collectionId?: string;
    characterId?: string;
  }>();
  const navigate = useNavigate();
  const setCollections = useSetAtom(collectionsAtom);

  const [collection, setCollection] = useState<Collection | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(
    characterId ?? null
  );

  const loadCollection = useCallback(async () => {
    if (!collectionId) return;
    const c = await getCollectionById(collectionId);
    if (c) {
      setCollection(c);
      // Select first character if none selected
      if (!selectedCharId && c.characters.length > 0) {
        setSelectedCharId(c.characters[0]!.id);
      }
    }
  }, [collectionId, selectedCharId]);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  const selectedChar = collection?.characters.find(
    (c) => c.id === selectedCharId
  );

  const handleAddCharacter = async () => {
    if (!collection) return;
    const newChar = createEmptyCharacter();
    const updated: Collection = {
      ...collection,
      characters: [...collection.characters, newChar],
      updated_at: new Date().toISOString(),
    };
    await saveCollection(updated);
    setCollection(updated);
    setSelectedCharId(newChar.id);
    // Sync global state
    const all = await getCollections();
    setCollections(all);
  };

  const handleDeleteCharacter = async (charId: string) => {
    if (!collection) return;
    const updated: Collection = {
      ...collection,
      characters: collection.characters.filter((c) => c.id !== charId),
      updated_at: new Date().toISOString(),
    };
    await saveCollection(updated);
    setCollection(updated);
    if (selectedCharId === charId) {
      setSelectedCharId(updated.characters[0]?.id ?? null);
    }
    const all = await getCollections();
    setCollections(all);
  };

  const handleSaveCharacter = async (character: Character) => {
    if (!collection) return;
    const updated: Collection = {
      ...collection,
      characters: collection.characters.map((c) =>
        c.id === character.id ? character : c
      ),
      updated_at: new Date().toISOString(),
    };
    await saveCollection(updated);
    setCollection(updated);
    const all = await getCollections();
    setCollections(all);
  };

  if (!collectionId) {
    return (
      <>
        <header className="main-content__header">
          <h1 className="main-content__title">Character Editor</h1>
        </header>
        <div className="main-content__body">
          <div className="empty-state">
            <div className="empty-state__icon">
              <Users size={28} />
            </div>
            <h2 className="empty-state__title">Select a collection</h2>
            <p className="empty-state__description">
              Open a collection from the Collections page to start editing
              characters.
            </p>
            <button
              className="btn btn--primary"
              onClick={() => navigate("/collections")}
            >
              Go to Collections
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="main-content__header">
        <button className="btn btn--ghost" onClick={() => navigate("/collections")}>
          <ArrowLeft size={16} />
          Collections
        </button>
        <h1 className="main-content__title" style={{ flex: 1 }}>
          {collection?.name ?? "Loading..."}
        </h1>
      </header>

      <div className="main-content__body">
        <div className="editor-layout">
          {/* Character sidebar */}
          <aside className="editor-sidebar">
            <div className="editor-sidebar__header">
              <span className="editor-sidebar__title">Characters</span>
              <button
                className="btn btn--ghost btn--icon btn--sm"
                onClick={handleAddCharacter}
                title="Add character"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="editor-sidebar__list">
              {collection?.characters.map((c) => (
                <div
                  key={c.id}
                  className={`editor-sidebar__item ${selectedCharId === c.id ? "editor-sidebar__item--active" : ""}`}
                  onClick={() => setSelectedCharId(c.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSelectedCharId(c.id);
                  }}
                >
                  <span className="editor-sidebar__item-name">{c.name}</span>
                  <button
                    className="btn btn--ghost btn--icon btn--xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCharacter(c.id);
                    }}
                    title="Delete character"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {collection?.characters.length === 0 && (
                <div className="editor-sidebar__empty">
                  No characters yet
                </div>
              )}
            </div>
          </aside>

          {/* Character form */}
          <div className="editor-main">
            {selectedChar ? (
              <CharacterForm
                key={selectedChar.id}
                character={selectedChar}
                collectionId={collectionId}
                onSave={handleSaveCharacter}
                onCancel={() => setSelectedCharId(null)}
              />
            ) : (
              <div className="empty-state">
                <h2 className="empty-state__title">
                  {collection?.characters.length === 0
                    ? "Add a character"
                    : "Select a character"}
                </h2>
                <p className="empty-state__description">
                  {collection?.characters.length === 0
                    ? 'Click the "+" button to create your first character.'
                    : "Click a character name in the sidebar to start editing."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
