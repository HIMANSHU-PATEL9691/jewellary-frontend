import { useEffect, useState } from "react";

// Small utility to debounce rapidly-changing values (e.g. search input)
export function useDebounce<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

