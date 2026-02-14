import { Pencil } from "lucide-react";

export function EditorPage() {
  return (
    <>
      <header className="main-content__header">
        <h1 className="main-content__title">Character Editor</h1>
      </header>
      <div className="main-content__body">
        <div className="empty-state">
          <div className="empty-state__icon">
            <Pencil size={28} />
          </div>
          <h2 className="empty-state__title">Select a character to edit</h2>
          <p className="empty-state__description">
            Choose a character from your collections to edit its tracks, metadata, and device address.
          </p>
        </div>
      </div>
    </>
  );
}
