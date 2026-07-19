import { create } from "zustand";
import { useUserStore } from "@/store/useUserStore";

export interface ShopItem {
  id: string;
  name: string;
  type: "theme" | "consumable" | "cosmetic";
  priceCoins: number;
  description: string;
  cssVariables: Record<string, string> | null;
  isLimited: boolean;
  availableUntil: string | null;
}

export interface ShopItemUI extends ShopItem {
  owned: boolean;
  isEquipped: boolean;
}

export interface InventoryItem {
  id: string;
  userId: string;
  itemId: string;
  purchasedAt: string;
  isEquipped: boolean;
  item: ShopItem;
}

interface ShopStore {
  items: ShopItemUI[];
  inventory: InventoryItem[];
  isLoading: boolean;
  error: string | null;

  fetchShopItems: () => Promise<void>;
  buyItem: (itemId: string) => Promise<void>;
  equipItem: (itemId: string) => Promise<void>;
  fetchInventory: () => Promise<void>;
}

// Helper function to apply a theme's CSS variables to the document root
export function applyTheme(cssVariables: Record<string, string> | null) {
  if (typeof window === "undefined") return;
  
  if (!cssVariables) {
    // Revert to default variables by removing overridden properties
    const defaultVars = [
      "--bg-primary",
      "--bg-secondary",
      "--bg-tertiary",
      "--border",
      "--accent-purple",
      "--accent-teal",
      "--accent-gold",
      "--text-primary",
      "--text-secondary",
      "--text-muted",
      "--heat-0",
      "--heat-1",
      "--heat-2",
      "--heat-3"
    ];
    for (const v of defaultVars) {
      document.documentElement.style.removeProperty(v);
    }
    return;
  }

  for (const [key, value] of Object.entries(cssVariables)) {
    document.documentElement.style.setProperty(key, value);
  }
}

export const useShopStore = create<ShopStore>((set, get) => ({
  items: [],
  inventory: [],
  isLoading: false,
  error: null,

  fetchShopItems: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/shop");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch shop items");
      }
      const data = await res.json();
      set({ items: data, isLoading: false });
    } catch (err) {
      const errorObj = err as Error;
      set({ error: errorObj.message, isLoading: false });
    }
  },

  buyItem: async (itemId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return;

    set({ error: null });
    const previousUserCoins = useUserStore.getState().coins;
    const previousItems = get().items;

    // Optimistic Update: Deduct coins from user store and mark item as owned in shop store
    useUserStore.setState({ coins: Math.max(0, previousUserCoins - item.priceCoins) });
    set({
      items: previousItems.map((i) => (i.id === itemId ? { ...i, owned: true } : i))
    });

    try {
      const res = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to buy item");
      }

      const data = await res.json(); // returns { coins, inventory }

      // Update user coins with real response
      useUserStore.setState({ coins: data.coins });

      // Refresh inventory and shop item list to sync completely
      await get().fetchInventory();
      await get().fetchShopItems();
    } catch (err) {
      // Rollback on failure
      useUserStore.setState({ coins: previousUserCoins });
      set({ items: previousItems });
      const errorObj = err as Error;
      set({ error: errorObj.message });
      throw err;
    }
  },

  equipItem: async (itemId) => {
    const previousItems = get().items;
    const targetItem = previousItems.find((i) => i.id === itemId);
    if (!targetItem) return;

    set({ error: null });

    // Optimistic Update: Mark target as equipped and unequip other items of the same type
    set({
      items: previousItems.map((i) => {
        if (i.type === targetItem.type) {
          return { ...i, isEquipped: i.id === itemId };
        }
        return i;
      })
    });

    try {
      const res = await fetch("/api/shop/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to equip item");
      }

      await res.json();

      // If it is a theme, apply the CSS variables live
      if (targetItem.type === "theme") {
        applyTheme(targetItem.cssVariables);
      }

      // Sync stores
      await get().fetchInventory();
      await get().fetchShopItems();
    } catch (err) {
      // Rollback on failure
      set({ items: previousItems });
      const errorObj = err as Error;
      set({ error: errorObj.message });
      throw err;
    }
  },

  fetchInventory: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/shop/inventory");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch inventory");
      }
      const data = await res.json();
      set({ inventory: data, isLoading: false });
    } catch (err) {
      const errorObj = err as Error;
      set({ error: errorObj.message, isLoading: false });
    }
  }
}));
