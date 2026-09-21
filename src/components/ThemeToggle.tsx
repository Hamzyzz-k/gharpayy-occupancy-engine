import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "gharpayy-theme";

/**
 * Light / dark switch. The choice is saved in localStorage and applied before
 * first paint by the boot script in __root.tsx, so reloads don't flash.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // Read the real state after mount; the server always renders light.
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      // Private mode or blocked storage: the toggle still works for this visit.
    }
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
