"use client";

import { useEffect, useState } from "react";
import { useShopStore, ShopItemUI } from "@/store/useShopStore";
import { useUserStore } from "@/store/useUserStore";
import { Coins, ShoppingBag, Check, Sparkles, Flame, ShieldAlert } from "lucide-react";

export default function ShopPage() {
  const {
    items,
    isLoading,
    error,
    fetchShopItems,
    buyItem,
    equipItem,
    fetchInventory
  } = useShopStore();

  const userCoins = useUserStore((state) => state.coins);
  const fetchUserStats = useUserStore((state) => state.fetchUserStats);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchShopItems();
    fetchInventory();
    fetchUserStats();
  }, [fetchShopItems, fetchInventory, fetchUserStats]);

  const handleBuy = async (item: ShopItemUI) => {
    if (userCoins < item.priceCoins) return;
    setActionLoadingId(item.id);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      await buyItem(item.id);
      setSuccessMessage(`Forged purchase: ${item.name}!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      const errorObj = err as Error;
      setErrorMessage(errorObj.message || "Failed to buy item");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEquip = async (item: ShopItemUI) => {
    setActionLoadingId(item.id);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      await equipItem(item.id);
      setSuccessMessage(`Equipped ${item.name}!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      const errorObj = err as Error;
      setErrorMessage(errorObj.message || "Failed to equip item");
    } finally {
      setActionLoadingId(null);
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "theme":
        return <Sparkles className="h-5 w-5 text-indigo-400" />;
      case "consumable":
        return <Flame className="h-5 w-5 text-orange-400" />;
      default:
        return <ShoppingBag className="h-5 w-5 text-slate-400" />;
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6" style={{ borderColor: "var(--border)" }}>
        <div>
          <h1
            className="text-3xl font-extrabold tracking-tight flex items-center gap-2"
            style={{ color: "var(--text-primary)" }}
          >
            <ShoppingBag className="h-8 w-8 text-purple-400" />
            Hero&apos;s Market
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Spend your gold coins on cosmetic themes and quest boosters
          </p>
        </div>

        {/* User Balance Card */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg border shadow-sm self-start sm:self-center"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-950/40 border border-yellow-800">
            <Coins className="h-5 w-5 text-yellow-400 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Gold Balance
            </div>
            <div className="text-lg font-black text-white">{userCoins} coins</div>
          </div>
        </div>
      </div>

      {/* Success / Error Messages */}
      {successMessage && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-bold text-center border"
          style={{
            backgroundColor: "rgba(13, 148, 136, 0.1)",
            color: "var(--accent-teal)",
            borderColor: "rgba(13, 148, 136, 0.2)",
          }}
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-bold text-center border"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            color: "var(--danger)",
            borderColor: "rgba(239, 68, 68, 0.2)",
          }}
        >
          {errorMessage}
        </div>
      )}

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-bold text-center border"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            color: "var(--danger)",
            borderColor: "rgba(239, 68, 68, 0.2)",
          }}
        >
          {error}
        </div>
      )}

      {/* Loading Skeleton Grid */}
      {isLoading && items.length === 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border p-5 h-64"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border)",
              }}
            />
          ))}
        </div>
      ) : (
        /* Shop Items Grid */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const hasSufficientCoins = userCoins >= item.priceCoins;
            const diffCoins = item.priceCoins - userCoins;
            const isActionLoading = actionLoadingId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-5 shadow-sm flex flex-col justify-between transition-all ${
                  item.isEquipped ? "ring-2" : ""
                }`}
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderColor: item.isEquipped ? "var(--accent-purple)" : "var(--border)",
                  boxShadow: item.isEquipped ? "0 0 12px rgba(124, 58, 237, 0.25)" : "none",
                }}
              >
                <div>
                  {/* Title & Icon */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg border"
                        style={{
                          backgroundColor: "var(--bg-tertiary)",
                          borderColor: "var(--border)",
                        }}
                      >
                        {getItemIcon(item.type)}
                      </div>
                      <div>
                        <h2
                          className="text-lg font-black tracking-tight"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {item.name}
                        </h2>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: "var(--bg-tertiary)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {item.type}
                        </span>
                      </div>
                    </div>

                    {/* Price Tag */}
                    {!item.owned && (
                      <div className="flex items-center gap-1">
                        <Coins className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-bold text-yellow-400">
                          {item.priceCoins}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p
                    className="mt-4 text-sm font-medium leading-relaxed h-16 overflow-hidden"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {item.description}
                  </p>
                </div>

                {/* State Button */}
                <div className="mt-6">
                  {item.isEquipped ? (
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-black text-white cursor-not-allowed opacity-90"
                      style={{ backgroundColor: "var(--accent-purple)" }}
                    >
                      <Check className="h-4 w-4" />
                      Active Equipped
                    </button>
                  ) : item.owned ? (
                    <button
                      onClick={() => handleEquip(item)}
                      disabled={isActionLoading}
                      className="w-full rounded-lg py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
                      style={{ backgroundColor: "var(--accent-teal)" }}
                    >
                      {isActionLoading ? "Equipping..." : "Equip"}
                    </button>
                  ) : (
                    <div className="relative group">
                      <button
                        onClick={() => handleBuy(item)}
                        disabled={!hasSufficientCoins || isActionLoading}
                        className="w-full rounded-lg py-2.5 text-sm font-bold text-white transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        style={{
                          backgroundColor: hasSufficientCoins
                            ? "var(--accent-purple)"
                            : "var(--bg-tertiary)",
                          border: hasSufficientCoins
                            ? "none"
                            : "1px solid var(--border)",
                          color: hasSufficientCoins ? "white" : "var(--text-muted)",
                        }}
                      >
                        {isActionLoading
                          ? "Forging..."
                          : hasSufficientCoins
                          ? "Buy Item"
                          : `Locked`}
                      </button>

                      {/* Tooltip for locked item */}
                      {!hasSufficientCoins && (
                        <div
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex items-center gap-1.5 rounded bg-slate-950 px-3 py-1.5 text-center text-xs font-semibold text-yellow-400 border border-yellow-800 shadow-md whitespace-nowrap z-10"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Need {diffCoins} more coins
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
