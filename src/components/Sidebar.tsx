import { NavLink } from "react-router-dom";
import { useAtom, useSetAtom } from "jotai";
import {
  Library,
  FolderOpen,
  Pencil,
  Settings,
  Usb,
  Moon,
  Sun,
} from "lucide-react";
import { deviceStatusAtom } from "@/stores/device";
import { themeAtom, toggleThemeAtom } from "@/stores/theme";

export function Sidebar() {
  const [device] = useAtom(deviceStatusAtom);
  const [theme] = useAtom(themeAtom);
  const toggleTheme = useSetAtom(toggleThemeAtom);

  return (
    <aside className="sidebar no-select">
      <div className="sidebar__brand">
        <div className="sidebar__brand-icon">FF</div>
        <span className="sidebar__brand-name">FableForge</span>
      </div>

      <nav className="sidebar__nav">
        <span className="sidebar__section-label">Discover</span>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
          }
        >
          <Library className="sidebar__link-icon" />
          Gallery
        </NavLink>

        <span className="sidebar__section-label">Manage</span>
        <NavLink
          to="/collections"
          className={({ isActive }) =>
            `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
          }
        >
          <FolderOpen className="sidebar__link-icon" />
          Collections
        </NavLink>
        <NavLink
          to="/editor"
          className={({ isActive }) =>
            `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
          }
        >
          <Pencil className="sidebar__link-icon" />
          Editor
        </NavLink>

        <span className="sidebar__section-label">System</span>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
          }
        >
          <Settings className="sidebar__link-icon" />
          Settings
        </NavLink>
      </nav>

      <div className="sidebar__footer">
        <div className="device-status">
          <span
            className={`device-status__dot ${
              device.connected
                ? "device-status__dot--connected"
                : "device-status__dot--disconnected"
            }`}
          />
          <Usb size={14} />
          {device.connected ? "Device connected" : "No device"}
        </div>
        <button
          className="btn btn--ghost btn--icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          style={{ marginTop: "var(--space-2)" }}
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </aside>
  );
}
