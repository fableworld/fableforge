import { FolderOpen } from "lucide-react";

export function CollectionsPage() {
  return (
    <>
      <header className="main-content__header">
        <h1 className="main-content__title">Collections</h1>
        <button className="btn btn--primary">New Collection</button>
      </header>
      <div className="main-content__body">
        <div className="empty-state">
          <div className="empty-state__icon">
            <FolderOpen size={28} />
          </div>
          <h2 className="empty-state__title">No local collections</h2>
          <p className="empty-state__description">
            Create a new collection to start organizing your custom characters
            and audio content.
          </p>
          <button className="btn btn--secondary btn--lg">
            Create Collection
          </button>
        </div>
      </div>
    </>
  );
}
