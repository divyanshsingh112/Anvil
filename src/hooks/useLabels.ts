import { useUserStore } from "@/store/useUserStore";
import { getTerminology, TerminologyPack } from "@/lib/themes/terminology";

/**
 * Hook to retrieve the active theme's terminology pack dynamically.
 * Responds reactively to activeTheme store state.
 */
export function useLabels(): TerminologyPack {
  const activeTheme = useUserStore((state) => state.activeTheme);
  return getTerminology(activeTheme);
}
