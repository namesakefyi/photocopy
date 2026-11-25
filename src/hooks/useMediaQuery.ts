import { useEffect, useState } from "react";

/** Phones, and windows too narrow for side panels. Matches the CSS breakpoint. */
export const NARROW = "(width < 760px)";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}
