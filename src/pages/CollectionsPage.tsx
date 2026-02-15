import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { FolderOpen, Plus } from "lucide-react";
import { collectionsAtom } from "@/stores/collections";
import { createEmptyCollection } from "@/stores/collections";
import {
  getCollections,
  saveCollection,
  removeCollection as removeCollectionStore,
} from "@/lib/store";
import { CollectionCard } from "@/components/CollectionCard";
import { CreateCollectionDialog } from "@/components/CreateCollectionDialog";

export function CollectionsPage() {
  const [collections, setCollections] = useAtom(collectionsAtom);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadCollections = useCallback(async () => {
    const data = await getCollections();
    setCollections(data);
  }, [setCollections]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const handleCreate = async (name: string, description?: string) => {
    const collection = createEmptyCollection(name);
    if (description) {
      collection.description = description;
    }
    await saveCollection(collection);
    await loadCollections();
  };

  const handleDelete = async (id: string) => {
    await removeCollectionStore(id);
    await loadCollections();
  };

  return (
    <>
      <header className="main-content__header">
        <h1 className="main-content__title">Collections</h1>
        <button
          className="btn btn--primary"
          onClick={() => setDialogOpen(true)}
        >
          <Plus size={16} />
          New Collection
        </button>
      </header>
      <div className="main-content__body">
        {collections.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <FolderOpen size={28} />
            </div>
            <h2 className="empty-state__title">No local collections</h2>
            <p className="empty-state__description">
              Create a new collection to start organizing your custom characters
              and audio content.
            </p>
            <button
              className="btn btn--primary btn--lg"
              onClick={() => setDialogOpen(true)}
            >
              Create Collection
            </button>
          </div>
        ) : (
          <div className="collections-grid">
            {collections.map((c) => (
              <CollectionCard
                key={c.id}
                collection={c}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <CreateCollectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
      />
    </>
  );
}
