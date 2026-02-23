import { useState, useEffect, useCallback } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Library, Plus } from "lucide-react";
import {
  registriesAtom,
  charactersAtom,
  filteredCharactersAtom,
  isLoadingAtom,
} from "@/stores/registries";
import { registryService } from "@/services/registry";
import { CharacterCard, CharacterCardSkeleton } from "@/components/CharacterCard";
import { SearchBar } from "@/components/SearchBar";
import { AddRegistryDialog } from "@/components/AddRegistryDialog";

export function GalleryPage() {
  const [registries] = useAtom(registriesAtom);
  const setRegistries = useSetAtom(registriesAtom);
  const [characters, setCharacters] = useAtom(charactersAtom);
  const [filtered] = useAtom(filteredCharactersAtom);
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await registryService.loadAll();
      setRegistries(data.registries);
      setCharacters(data.characters);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [setRegistries, setCharacters, setIsLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasData = registries.length > 0 || characters.length > 0;

  return (
    <>
      <header className="main-content__header">
        <h1 className="main-content__title">Gallery</h1>
        <button
          className="btn btn--primary"
          onClick={() => setDialogOpen(true)}
        >
          <Plus size={16} />
          Add Registry
        </button>
      </header>

      <div className="main-content__body">
        {!hasData && !isLoading ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <Library size={28} />
            </div>
            <h2 className="empty-state__title">No collections yet</h2>
            <p className="empty-state__description">
              Add a registry to discover characters, or create your own
              collection from scratch.
            </p>
            <button
              className="btn btn--primary btn--lg"
              onClick={() => setDialogOpen(true)}
            >
              Add Registry
            </button>
          </div>
        ) : (
          <>
            <SearchBar />
            <div
              className="gallery-grid"
              style={{ marginTop: "var(--space-5)" }}
            >
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                  <CharacterCardSkeleton key={i} />
                ))
                : filtered.map((character) => (
                  <CharacterCard key={character.id} character={character} />
                ))}
            </div>
            {!isLoading && filtered.length === 0 && hasData && (
              <div className="empty-state" style={{ paddingTop: "var(--space-10)" }}>
                <h2 className="empty-state__title">No matches</h2>
                <p className="empty-state__description">
                  Try a different search query.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <AddRegistryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onRegistryAdded={loadData}
      />
    </>
  );
}
