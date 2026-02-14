import { Library } from "lucide-react";

export function GalleryPage() {
  return (
    <>
      <header className="main-content__header">
        <h1 className="main-content__title">Gallery</h1>
      </header>
      <div className="main-content__body">
        <div className="empty-state">
          <div className="empty-state__icon">
            <Library size={28} />
          </div>
          <h2 className="empty-state__title">No collections yet</h2>
          <p className="empty-state__description">
            Add a registry to discover characters, or create your own collection
            from scratch.
          </p>
          <button className="btn btn--primary btn--lg">Add Registry</button>
        </div>
      </div>
    </>
  );
}
