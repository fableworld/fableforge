import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Users } from "lucide-react";
import type { Collection } from "@/lib/schemas";

interface CollectionCardProps {
  collection: Collection;
  onDelete: (id: string) => void;
}

export function CollectionCard({ collection, onDelete }: CollectionCardProps) {
  const navigate = useNavigate();

  return (
    <div className="collection-card">
      <div
        className="collection-card__body"
        onClick={() => navigate(`/editor/${collection.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(`/editor/${collection.id}`);
          }
        }}
      >
        {collection.cover_image ? (
          <img
            className="collection-card__cover"
            src={collection.cover_image}
            alt={collection.name}
          />
        ) : (
          <div className="collection-card__cover-placeholder">
            <Users size={24} />
          </div>
        )}
        <div className="collection-card__info">
          <div className="collection-card__name">{collection.name}</div>
          {collection.description && (
            <div className="collection-card__desc">
              {collection.description}
            </div>
          )}
          <div className="collection-card__meta">
            {collection.characters.length} character
            {collection.characters.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
      <div className="collection-card__actions">
        <button
          className="btn btn--ghost btn--icon btn--sm"
          onClick={() => navigate(`/editor/${collection.id}`)}
          title="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          className="btn btn--ghost btn--icon btn--sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(collection.id);
          }}
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
