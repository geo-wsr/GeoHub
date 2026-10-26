export type Theme = "light" | "dark";

export function getInitialTheme(): Theme {
  const stored = window.localStorage.getItem("quanhezi-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
