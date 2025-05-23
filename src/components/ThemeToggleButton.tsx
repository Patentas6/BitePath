"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // useEffect only runs on the client, so we can safely show the UI
  // and avoid hydration mismatch if theme is "system"
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a disabled button or placeholder to prevent layout shift
    // and avoid hydration errors before client-side theme resolution.
    return <Button variant="outline" size="icon" disabled className="h-9 w-9 md:h-8 md:w-8" />;
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className="h-9 w-9 md:h-8 md:w-8" // Consistent sizing with other header buttons
    >
      {theme === "dark" ? (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      )}
    </Button>
  );
}