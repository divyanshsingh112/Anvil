"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUserStore } from "@/store/useUserStore";
import {
  ShieldAlert,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Crown,
  Shield,
  User as UserIcon,
  Calendar,
  AtSign,
  ShieldCheck,
  Check,
  AlertCircle,
} from "lucide-react";

interface AdminUserRow {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  role: "USER" | "ADMIN";
  isSuperAdmin: boolean;
  adminPermissions: string[];
  createdAt: string;
  hasSeenConsentPrompt: boolean;
}

interface ViewerMeta {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  isSuperAdmin: boolean;
  adminPermissions: string[];
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const AVAILABLE_PERMISSIONS = [
  {
    key: "VIEW_USERS",
    label: "View Users",
    description: "Browse and search realm user directory",
  },
  {
    key: "DELETE_USERS",
    label: "Delete Users",
    description: "Permanently delete regular player accounts",
  },
  {
    key: "MANAGE_ADMINS",
    label: "Manage Admins",
    description: "Grant, revoke, and edit admin roles & permissions",
  },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const { role, isLoading: isUserStoreLoading } = useUserStore();

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [viewer, setViewer] = useState<ViewerMeta | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manage Access Modal State
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [targetRole, setTargetRole] = useState<"USER" | "ADMIN">("USER");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  // 1. Debounce search query input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput]);

  // 2. Client-side role guard: redirect if not ADMIN once auth/store resolves
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login");
    } else if (authStatus === "authenticated" && !isUserStoreLoading && role && role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [authStatus, role, isUserStoreLoading, router]);

  // 3. Fetch user list from backend
  useEffect(() => {
    if (authStatus === "unauthenticated") return;

    let isMounted = true;

    async function fetchUsers() {
      setIsLoadingUsers(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          page: String(pagination.page),
          limit: String(pagination.limit),
          search: debouncedSearch,
        });

        const res = await fetch(`/api/admin/users?${queryParams.toString()}`);

        if (res.status === 401) {
          router.replace("/login");
          return;
        }

        if (res.status === 403) {
          router.replace("/dashboard");
          return;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to load users");
        }

        const data = await res.json();
        if (isMounted) {
          setUsers(data.users || []);
          if (data.viewer) {
            setViewer(data.viewer);
          }
          setPagination(data.pagination || {
            page: 1,
            limit: 50,
            total: 0,
            totalPages: 1,
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to load users");
        }
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false);
        }
      }
    }

    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, [pagination.page, pagination.limit, debouncedSearch, authStatus, router]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.page) {
      setPagination((prev) => ({ ...prev, page: newPage }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Determine if viewing admin can manage roles
  const canManageAdmins =
    viewer?.isSuperAdmin === true ||
    (viewer?.role === "ADMIN" && viewer?.adminPermissions?.includes("MANAGE_ADMINS"));

  const openManageModal = (user: AdminUserRow) => {
    setSelectedUser(user);
    setTargetRole(user.role);
    setSelectedPermissions(Array.isArray(user.adminPermissions) ? [...user.adminPermissions] : []);
    setModalError(null);
    setModalSuccess(null);
  };

  const closeManageModal = () => {
    if (isSaving) return;
    setSelectedUser(null);
    setModalError(null);
    setModalSuccess(null);
  };

  const handlePermissionToggle = (permKey: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
  };

  const handleSaveRoleAndPermissions = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: targetRole,
          permissions: targetRole === "ADMIN" ? selectedPermissions : [],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update role and permissions");
      }

      setModalSuccess(`Successfully updated ${selectedUser.email}`);

      // Update local state in table
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? {
                ...u,
                role: targetRole,
                adminPermissions: targetRole === "ADMIN" ? selectedPermissions : [],
              }
            : u
        )
      );

      setTimeout(() => {
        closeManageModal();
      }, 1000);
    } catch (err: any) {
      setModalError(err.message || "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  // HARD GUARD: If user is not authenticated or not an ADMIN, never render the admin console DOM
  if (authStatus === "loading" || isUserStoreLoading || !role || role !== "ADMIN") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--text-secondary)" }}>
            Verifying Access...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col gap-6 pb-28"
      style={{ color: "var(--text-primary)" }}
    >
      {/* Header Banner */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-start gap-3.5">
          <div
            className="p-3 rounded-xl border flex items-center justify-center shrink-0"
            style={{
              backgroundColor: "rgba(168, 85, 247, 0.12)",
              borderColor: "rgba(168, 85, 247, 0.3)",
              color: "#c084fc",
            }}
          >
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Admin Console
              </h1>
              <span
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: "rgba(168, 85, 247, 0.15)",
                  borderColor: "rgba(168, 85, 247, 0.3)",
                  color: "#c084fc",
                }}
              >
                {viewer?.isSuperAdmin ? "Super Admin" : "Admin Portal"}
              </span>
            </div>
            <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Inspect realm accounts, manage role permissions, and view active players.
            </p>
          </div>
        </div>

        {/* User Count Pill */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold self-start sm:self-auto"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border)",
          }}
        >
          <Users className="h-4 w-4 text-purple-400" />
          <span style={{ color: "var(--text-secondary)" }}>Total Accounts:</span>
          <span className="text-white font-mono">{pagination.total}</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email, username, or name..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-xs sm:text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-purple-500/40"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          {searchInput && (
            <button
              onClick={handleClearSearch}
              aria-label="Clear search input"
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {debouncedSearch && (
          <div className="text-xs text-purple-300 font-medium self-start sm:self-auto">
            Filtered results for &quot;<span className="font-semibold text-white">{debouncedSearch}</span>&quot;
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div
          className="rounded-xl p-4 border text-xs sm:text-sm text-center"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            borderColor: "rgba(239, 68, 68, 0.2)",
            color: "#f87171",
          }}
        >
          {error}
        </div>
      )}

      {/* User Table Card */}
      <div
        className="rounded-2xl border overflow-hidden shadow-xl"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr
                className="border-b text-[11px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <th className="py-3.5 px-4 sm:px-6">Player / Email</th>
                <th className="py-3.5 px-4 sm:px-6">Username</th>
                <th className="py-3.5 px-4 sm:px-6">Role</th>
                <th className="py-3.5 px-4 sm:px-6">Joined Date</th>
                {canManageAdmins && <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={canManageAdmins ? 5 : 4} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        Loading player records...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={canManageAdmins ? 5 : 4} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 opacity-40 text-purple-400" />
                      <p className="text-sm font-semibold text-white">No users found</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {debouncedSearch
                          ? `No players matched "${debouncedSearch}". Try a different query.`
                          : "No player accounts are registered in the realm."}
                      </p>
                      {debouncedSearch && (
                        <button
                          onClick={handleClearSearch}
                          className="mt-2 text-xs font-bold text-purple-400 hover:text-purple-300 underline"
                        >
                          Clear Search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const joinedDate = new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });

                  const isCurrentViewer = viewer?.id === user.id;
                  const isProtectedSuperAdmin = user.isSuperAdmin === true;

                  return (
                    <tr
                      key={user.id}
                      className="transition-colors duration-150 hover:bg-white/[0.02]"
                    >
                      {/* Player / Email */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border"
                            style={{
                              backgroundColor: user.isSuperAdmin
                                ? "rgba(245, 158, 11, 0.15)"
                                : user.role === "ADMIN"
                                ? "rgba(168, 85, 247, 0.15)"
                                : "var(--bg-tertiary)",
                              borderColor: user.isSuperAdmin
                                ? "rgba(245, 158, 11, 0.3)"
                                : user.role === "ADMIN"
                                ? "rgba(168, 85, 247, 0.3)"
                                : "var(--border)",
                              color: user.isSuperAdmin
                                ? "#fbbf24"
                                : user.role === "ADMIN"
                                ? "#c084fc"
                                : "var(--text-secondary)",
                            }}
                          >
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                              {user.displayName}
                            </span>
                            <span
                              className="text-xs truncate max-w-[200px] sm:max-w-xs"
                              style={{ color: "var(--text-secondary)" }}
                              title={user.email}
                            >
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="py-4 px-4 sm:px-6">
                        {user.username ? (
                          <div className="flex items-center gap-1 font-mono text-xs text-purple-300">
                            <AtSign className="h-3 w-3 opacity-60" />
                            <span>{user.username}</span>
                          </div>
                        ) : (
                          <span className="text-xs italic" style={{ color: "var(--text-secondary)" }}>
                            Not set
                          </span>
                        )}
                      </td>

                      {/* Role Badge */}
                      <td className="py-4 px-4 sm:px-6">
                        {user.isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider border bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                            <Crown className="h-3 w-3 text-amber-400" />
                            Super Admin
                          </span>
                        ) : user.role === "ADMIN" ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border bg-purple-500/15 border-purple-500/30 text-purple-300 w-fit">
                              <Shield className="h-3 w-3 text-purple-400" />
                              Admin
                            </span>
                            {Array.isArray(user.adminPermissions) && user.adminPermissions.length > 0 && (
                              <span className="text-[10px] text-purple-300/70 font-mono">
                                {user.adminPermissions.join(", ")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border bg-slate-800/60 border-slate-700/60 text-slate-400">
                            <UserIcon className="h-3 w-3 opacity-60" />
                            User
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                          <Calendar className="h-3.5 w-3.5 opacity-60" />
                          <span>{joinedDate}</span>
                        </div>
                      </td>

                      {/* Manage Actions Column */}
                      {canManageAdmins && (
                        <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                          {isProtectedSuperAdmin ? (
                            <span className="text-[11px] text-amber-400/50 italic">Protected</span>
                          ) : isCurrentViewer ? (
                            <span className="text-[11px] text-purple-400/50 italic">Your Account</span>
                          ) : (
                            <button
                              onClick={() => openManageModal(user)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:bg-purple-500/20 hover:border-purple-500/40 text-purple-300 border-purple-500/30"
                              title="Manage role & permissions"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>Manage Access</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          className="px-4 sm:px-6 py-3.5 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "rgba(0, 0, 0, 0.15)",
            color: "var(--text-secondary)",
          }}
        >
          <div>
            Showing{" "}
            <span className="font-semibold text-white">
              {users.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-white">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            of <span className="font-semibold text-white">{pagination.total}</span> player records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoadingUsers}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/[0.05]"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <span className="px-2 font-mono font-bold text-white">
              {pagination.page} / {pagination.totalPages || 1}
            </span>

            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isLoadingUsers}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/[0.05]"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Manage Access Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={closeManageModal}
            aria-hidden="true"
          />

          {/* Modal Card */}
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
            }}
          >
            {/* Modal Header */}
            <div
              className="p-5 border-b flex items-center justify-between"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="p-2.5 rounded-xl border flex items-center justify-center"
                  style={{
                    backgroundColor: "rgba(168, 85, 247, 0.12)",
                    borderColor: "rgba(168, 85, 247, 0.3)",
                    color: "#c084fc",
                  }}
                >
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Manage User Access</h2>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Update administrative permissions for {selectedUser.email}
                  </p>
                </div>
              </div>

              <button
                onClick={closeManageModal}
                disabled={isSaving}
                className="p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
              {/* Target User Banner */}
              <div
                className="p-3.5 rounded-xl border flex items-center justify-between text-xs"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  borderColor: "var(--border)",
                }}
              >
                <div>
                  <span className="font-semibold text-white block">{selectedUser.displayName}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{selectedUser.email}</span>
                </div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
                  style={{
                    backgroundColor: selectedUser.role === "ADMIN" ? "rgba(168, 85, 247, 0.15)" : "var(--bg-primary)",
                    borderColor: selectedUser.role === "ADMIN" ? "rgba(168, 85, 247, 0.3)" : "var(--border)",
                    color: selectedUser.role === "ADMIN" ? "#c084fc" : "var(--text-secondary)",
                  }}
                >
                  Current: {selectedUser.role}
                </span>
              </div>

              {/* Status Notifications */}
              {modalError && (
                <div
                  className="p-3.5 rounded-xl border text-xs flex items-center gap-2"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    borderColor: "rgba(239, 68, 68, 0.2)",
                    color: "#f87171",
                  }}
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {modalSuccess && (
                <div
                  className="p-3.5 rounded-xl border text-xs flex items-center gap-2"
                  style={{
                    backgroundColor: "rgba(34, 197, 94, 0.1)",
                    borderColor: "rgba(34, 197, 94, 0.2)",
                    color: "#4ade80",
                  }}
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{modalSuccess}</span>
                </div>
              )}

              {/* Role Toggle Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-white">
                  Assigned Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetRole("USER")}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      targetRole === "USER"
                        ? "border-purple-500 bg-purple-500/20 text-purple-300 shadow-md"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                    }`}
                  >
                    <UserIcon className="h-4 w-4" />
                    <span>Regular User</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetRole("ADMIN")}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      targetRole === "ADMIN"
                        ? "border-purple-500 bg-purple-500/20 text-purple-300 shadow-md"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                    <span>Administrator</span>
                  </button>
                </div>
              </div>

              {/* Granular Permissions (Only active if targetRole === 'ADMIN') */}
              {targetRole === "ADMIN" && (
                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-white">
                      Granular Admin Permissions
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPermissions(AVAILABLE_PERMISSIONS.map((p) => p.key))
                        }
                        className="text-purple-400 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-gray-600">•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedPermissions([])}
                        className="text-gray-400 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {AVAILABLE_PERMISSIONS.map((perm) => {
                      const isChecked = selectedPermissions.includes(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                            isChecked
                              ? "bg-purple-950/30 border-purple-500/50"
                              : "bg-black/20 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handlePermissionToggle(perm.key)}
                            className="mt-0.5 h-4 w-4 rounded text-purple-600 focus:ring-purple-500 bg-black/40 border-slate-700"
                          />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{perm.label}</span>
                            <span className="text-[11px] text-gray-400">{perm.description}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className="p-4 border-t flex items-center justify-end gap-2.5"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "rgba(0, 0, 0, 0.2)",
              }}
            >
              <button
                type="button"
                onClick={closeManageModal}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl border text-xs font-bold transition-all text-gray-300 hover:bg-white/[0.05]"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoleAndPermissions}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
