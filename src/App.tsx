import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useAtom } from "jotai";
import { themeAtom } from "@/stores/theme";
import { Sidebar } from "@/components/Sidebar";
import { GalleryPage } from "@/pages/GalleryPage";
import { CollectionsPage } from "@/pages/CollectionsPage";
import { EditorPage } from "@/pages/EditorPage";
import { SettingsPage } from "@/pages/SettingsPage";

export function App() {
  const [theme] = useAtom(themeAtom);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<GalleryPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
