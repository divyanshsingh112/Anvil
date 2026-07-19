"use client";

import { useEffect } from "react";
import { useUserStore } from "@/store/useUserStore";
import { useShopStore, applyTheme } from "@/store/useShopStore";

export default function ThemeApplier() {
  const activeThemeName = useUserStore((state) => state.activeTheme);
  const inventory = useShopStore((state) => state.inventory);
  const fetchInventory = useShopStore((state) => state.fetchInventory);
  const fetchUserStats = useUserStore((state) => state.fetchUserStats);

  // Fetch stats and inventory on app mount to ensure theme loads
  useEffect(() => {
    fetchUserStats();
    fetchInventory();
  }, [fetchUserStats, fetchInventory]);

  // Apply theme when inventory or activeThemeName updates
  useEffect(() => {
    if (activeThemeName === "default") {
      applyTheme(null);
      return;
    }

    const equippedTheme = inventory.find(
      (inv) => inv.isEquipped && inv.item.type === "theme"
    );

    if (equippedTheme && equippedTheme.item.cssVariables) {
      applyTheme(equippedTheme.item.cssVariables);
    } else {
      // Revert if none found equipped but user store activeTheme has updated
      applyTheme(null);
    }
  }, [activeThemeName, inventory]);

  return null; // pure logic component, renders nothing
}
