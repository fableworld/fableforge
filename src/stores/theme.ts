import { atom } from "jotai";

type Theme = "light" | "dark";

const getInitialTheme = (): Theme => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("fableforge-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
};

export const themeAtom = atom<Theme>(getInitialTheme());

export const toggleThemeAtom = atom(null, (get, set) => {
  const next = get(themeAtom) === "light" ? "dark" : "light";
  set(themeAtom, next);
  localStorage.setItem("fableforge-theme", next);
  document.documentElement.setAttribute("data-theme", next);
});
