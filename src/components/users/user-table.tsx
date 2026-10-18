"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  UserX,
  Power,
  Loader2,
  Mail,
  Phone,
  Calendar,
  Lock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import {
  updateUserRole,
  updateUserStatus,
  approveCustomerUser,
  deactivateCustomerUser,
  type UserProfileRow,
} from "@/actions/users";
import type { UserRole } from "@/types";

export interface UserManagementRow extends UserProfileRow {
  email: string | null;
}

interface UserTableProps {
  users: UserManagementRow[];
  currentUserId: string;
}

type RoleFilter = "ALL" | "ADMIN" | "STAFF" | "CUSTOMER";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "PENDING";

function getInitials(name: string): string {
  if (!name || !name.trim()) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserTable({ users, currentUserId }: UserTableProps) {
  const router = useRouter();

  // Filters state
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  // Role dialog state
  const [roleTarget, setRoleTarget] = React.useState<{
    user: UserManagementRow;
    newRole: UserRole;
  } | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = React.useState(false);

  // Status dialog state
  const [statusTarget, setStatusTarget] = React.useState<{
    user: UserManagementRow;
    newStatus: boolean;
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  // Customer approval dialog state
  const [approveTarget, setApproveTarget] = React.useState<UserManagementRow | null>(null);
  const [isApprovingCustomer, setIsApprovingCustomer] = React.useState(false);

  // Customer deactivation dialog state
  const [deactivateCustomerTarget, setDeactivateCustomerTarget] =
    React.useState<UserManagementRow | null>(null);
  const [isDeactivatingCustomer, setIsDeactivatingCustomer] = React.useState(false);

  // Count active administrators in system
  const activeAdminCount = React.useMemo(() => {
    return users.filter((u) => u.role === "ADMIN" && u.is_active).length;
  }, [users]);

  // Filtered users calculation
  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (roleFilter !== "ALL" && u.role !== roleFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === "ACTIVE" && !u.is_active) return false;
      if (statusFilter === "INACTIVE" && u.is_active) return false;
      // PENDING = customers awaiting approval (inactive customer accounts)
      if (statusFilter === "PENDING" && !(u.role === "CUSTOMER" && !u.is_active)) return false;

      // Text search
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchesName = u.full_name?.toLowerCase().includes(query);
        const matchesEmail = u.email?.toLowerCase().includes(query);
        const matchesPhone = u.phone?.toLowerCase().includes(query);
        const matchesId = u.id?.toLowerCase().includes(query);
        return matchesName || matchesEmail || matchesPhone || matchesId;
      }

      return true;
    });
  }, [users, roleFilter, statusFilter, search]);

  // Pending customer count for badge
  const pendingCustomerCount = React.useMemo(
    () => users.filter((u) => u.role === "CUSTOMER" && !u.is_active).length,
    [users]
  );

  const hasActiveFilters =
    search.trim() !== "" || roleFilter !== "ALL" || statusFilter !== "ALL";

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
  };

  // Handlers for confirming sensitive actions
  const handleConfirmRoleChange = async () => {
    if (!roleTarget) return;

    setIsUpdatingRole(true);
    try {
      const result = await updateUserRole({
        targetUserId: roleTarget.user.id,
        role: roleTarget.newRole,
      });

      if (result.success) {
        toast.success(
          `Role for ${roleTarget.user.full_name} changed to ${roleTarget.newRole}.`
        );
        setRoleTarget(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update user role.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusTarget) return;

    setIsUpdatingStatus(true);
    try {
      const result = await updateUserStatus({
        targetUserId: statusTarget.user.id,
        isActive: statusTarget.newStatus,
      });

      if (result.success) {
        toast.success(
          statusTarget.newStatus
            ? `Account for ${statusTarget.user.full_name} activated successfully.`
            : `Account for ${statusTarget.user.full_name} deactivated.`
        );
        setStatusTarget(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update account status.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleConfirmApproveCustomer = async () => {
    if (!approveTarget) return;
    setIsApprovingCustomer(true);
    try {
      const result = await approveCustomerUser({ targetUserId: approveTarget.id });
      if (result.success) {
        toast.success(`Customer account for ${approveTarget.full_name} approved successfully.`);
        setApproveTarget(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to approve customer account.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsApprovingCustomer(false);
    }
  };

  const handleConfirmDeactivateCustomer = async () => {
    if (!deactivateCustomerTarget) return;
    setIsDeactivatingCustomer(true);
    try {
      const result = await deactivateCustomerUser(deactivateCustomerTarget.id);
      if (result.success) {
        toast.success(`Customer account for ${deactivateCustomerTarget.full_name} deactivated.`);
        setDeactivateCustomerTarget(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to deactivate customer account.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsDeactivatingCustomer(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls & Filters Bar */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone..."
                className="pl-9 h-9 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Role Filter */}
              <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 p-0.5 text-xs">
                <span className="px-2 py-1 text-muted-foreground font-medium flex items-center gap-1">
                  <Shield className="size-3" /> Role:
                </span>
                {(["ALL", "ADMIN", "STAFF", "CUSTOMER"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoleFilter(r)}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium transition-all",
                      roleFilter === r
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {r === "ALL" ? "All" : r}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 p-0.5 text-xs">
                <span className="px-2 py-1 text-muted-foreground font-medium flex items-center gap-1">
                  <Power className="size-3" /> Status:
                </span>
                {(["ALL", "ACTIVE", "INACTIVE", "PENDING"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium transition-all",
                      statusFilter === s
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s === "ALL"
                      ? "All"
                      : s === "ACTIVE"
                      ? "Active"
                      : s === "INACTIVE"
                      ? "Inactive"
                      : pendingCustomerCount > 0
                      ? `Pending (${pendingCustomerCount})`
                      : "Pending"}
                  </button>
                ))}
              </div>

              {/* Reset Filters Button */}
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                >
                  <RotateCcw className="size-3" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2.5">
            <span>
              Showing <strong className="text-foreground">{filteredUsers.length}</strong> of{" "}
              <strong className="text-foreground">{users.length}</strong> accounts
            </span>
            <span className="flex items-center gap-1">
              <ShieldAlert className="size-3 text-amber-500" />
              <span>Self-modification and last administrator removal are protected.</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[260px] font-semibold text-xs py-3">
                  User Account
                </TableHead>
                <TableHead className="font-semibold text-xs py-3">
                  Contact Information
                </TableHead>
                <TableHead className="font-semibold text-xs py-3">
                  Role
                </TableHead>
                <TableHead className="font-semibold text-xs py-3">
                  Status
                </TableHead>
                <TableHead className="hidden md:table-cell font-semibold text-xs py-3">
                  Registered
                </TableHead>
                <TableHead className="hidden lg:table-cell font-semibold text-xs py-3">
                  Last Updated
                </TableHead>
                <TableHead className="text-right font-semibold text-xs py-3 pr-4">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-48 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center space-y-2 py-8">
                      <div className="p-3 rounded-full bg-muted/60 text-muted-foreground">
                        <UserX className="size-6" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {users.length === 0
                          ? "No user profiles registered"
                          : "No accounts match current filters"}
                      </p>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        {users.length === 0
                          ? "User profiles are automatically provisioned when staff sign up via Clerk authentication."
                          : "Try adjusting your search terms or filter selection to locate the user."}
                      </p>
                      {hasActiveFilters && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={resetFilters}
                          className="mt-2 text-xs"
                        >
                          Clear all filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrentUser = user.id === currentUserId;
                  const isLastActiveAdmin =
                    user.role === "ADMIN" && user.is_active && activeAdminCount <= 1;

                  return (
                    <TableRow
                      key={user.id}
                      className={cn(
                        "text-xs transition-colors hover:bg-muted/40",
                        !user.is_active && "opacity-75 bg-muted/10",
                        isCurrentUser && "bg-primary/[0.02]"
                      )}
                    >
                      {/* User Account */}
                      <TableCell className="py-3 font-medium">
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={user.avatar_url}
                              alt={user.full_name}
                              className="size-8 rounded-full object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
                              {getInitials(user.full_name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-foreground text-sm truncate">
                                {user.full_name}
                              </span>
                              {isCurrentUser && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-primary/10 text-primary border-primary/20 font-medium py-0 px-1.5"
                                >
                                  You
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono block truncate">
                              ID: {user.id.slice(0, 14)}...
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Contact Info */}
                      <TableCell className="py-3">
                        <div className="space-y-1">
                          {user.email ? (
                            <div className="flex items-center gap-1.5 text-foreground">
                              <Mail className="size-3 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[180px]">{user.email}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                          {user.phone ? (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Phone className="size-3 shrink-0" />
                              <span>{user.phone}</span>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>

                      {/* Role */}
                      <TableCell className="py-3">
                        {user.role === "ADMIN" ? (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50 hover:bg-purple-100">
                            <Shield className="size-3 mr-1" /> ADMIN
                          </Badge>
                        ) : user.role === "CUSTOMER" ? (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50 hover:bg-blue-100">
                            <User className="size-3 mr-1" /> CUSTOMER
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            <User className="size-3 mr-1" /> STAFF
                          </Badge>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3">
                        {user.is_active ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/10">
                            <CheckCircle2 className="size-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 dark:bg-amber-950/20"
                          >
                            <UserX className="size-3 mr-1" /> Inactive
                          </Badge>
                        )}
                      </TableCell>

                      {/* Registered Timestamp */}
                      <TableCell
                        className="py-3 hidden md:table-cell text-muted-foreground text-[11px]"
                        suppressHydrationWarning
                      >
                        <div className="flex items-center gap-1.5" title={formatDateTime(user.created_at)}>
                          <Calendar className="size-3 text-muted-foreground/70" />
                          <span>{formatDate(user.created_at)}</span>
                        </div>
                      </TableCell>

                      {/* Last Updated Timestamp */}
                      <TableCell
                        className="py-3 hidden lg:table-cell text-muted-foreground text-[11px]"
                        suppressHydrationWarning
                      >
                        <span title={formatDateTime(user.updated_at)}>
                          {formatDate(user.updated_at)}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {isCurrentUser ? (
                            <span
                              title="Security protection: You cannot alter your own role or deactivate your own active session."
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium px-2 py-1 rounded-md bg-muted/60 border border-border/50"
                            >
                              <Lock className="size-3 text-muted-foreground" />
                              Privileges Locked
                            </span>
                          ) : user.role === "CUSTOMER" ? (
                            // Customer-domain actions
                            <>
                              {!user.is_active ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                  title="Approve this customer account and grant portal access"
                                  onClick={() => setApproveTarget(user)}
                                >
                                  <UserCheck className="size-3" />
                                  Approve
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1 text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                                  title="Deactivate this customer account"
                                  onClick={() => setDeactivateCustomerTarget(user)}
                                >
                                  <Power className="size-3" />
                                  Deactivate
                                </Button>
                              )}
                            </>
                          ) : (
                            // Internal staff / admin actions
                            <>
                              {/* Role Change Control */}
                              {user.role === "STAFF" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-900/50 dark:text-purple-300 dark:hover:bg-purple-950/30"
                                  title="Promote staff member to Administrator"
                                  onClick={() =>
                                    setRoleTarget({ user, newRole: "ADMIN" })
                                  }
                                >
                                  <ShieldCheck className="size-3 text-purple-600 dark:text-purple-400" />
                                  Make Admin
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isLastActiveAdmin}
                                  className={cn(
                                    "h-7 text-xs gap-1 text-slate-700 dark:text-slate-300",
                                    isLastActiveAdmin && "opacity-50 cursor-not-allowed"
                                  )}
                                  title={
                                    isLastActiveAdmin
                                      ? "Cannot demote the only active administrator in the system."
                                      : "Demote administrator to Staff"
                                  }
                                  onClick={() =>
                                    setRoleTarget({ user, newRole: "STAFF" })
                                  }
                                >
                                  <User className="size-3" />
                                  Set as Staff
                                </Button>
                              )}

                              {/* Activate / Deactivate Control */}
                              {user.is_active ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isLastActiveAdmin}
                                  className={cn(
                                    "h-7 text-xs gap-1 text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/30",
                                    isLastActiveAdmin && "opacity-50 cursor-not-allowed"
                                  )}
                                  title={
                                    isLastActiveAdmin
                                      ? "Cannot deactivate the only active administrator in the system."
                                      : "Deactivate user account"
                                  }
                                  onClick={() =>
                                    setStatusTarget({ user, newStatus: false })
                                  }
                                >
                                  <Power className="size-3" />
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50 dark:border-green-900/50 dark:text-green-400 dark:hover:bg-green-950/30"
                                  title="Activate user account"
                                  onClick={() =>
                                    setStatusTarget({ user, newStatus: true })
                                  }
                                >
                                  <Power className="size-3" />
                                  Activate
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Change Confirmation Dialog */}
      <Dialog
        open={!!roleTarget}
        onOpenChange={(open) => {
          if (!open && !isUpdatingRole) {
            setRoleTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <Shield className="size-4" />
              </div>
              <DialogTitle className="text-base font-semibold">
                Change User Role
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1">
              Update role assignment and system permissions for this user account.
            </DialogDescription>
          </DialogHeader>

          {roleTarget && (
            <div className="space-y-4 py-2">
              {/* User Summary Box */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/60">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
                    {getInitials(roleTarget.user.full_name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {roleTarget.user.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {roleTarget.user.email || roleTarget.user.phone || "No contact info"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Badge variant="outline" className="text-xs">
                    {roleTarget.user.role}
                  </Badge>
                  <span className="text-muted-foreground font-medium">→</span>
                  <Badge
                    className={
                      roleTarget.newRole === "ADMIN"
                        ? "bg-purple-600 hover:bg-purple-700 text-white"
                        : "bg-slate-700 hover:bg-slate-800 text-white"
                    }
                  >
                    {roleTarget.newRole}
                  </Badge>
                </div>
              </div>

              {/* Consequence Alert */}
              {roleTarget.user.role === "CUSTOMER" || roleTarget.newRole === "CUSTOMER" ? (
                <Alert className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                    Cross-Domain Role Transition
                  </AlertTitle>
                  <AlertDescription className="text-xs text-amber-800/80 dark:text-amber-300/80">
                    {roleTarget.newRole === "CUSTOMER"
                      ? "Changing this account to CUSTOMER will immediately revoke internal farm operational access (production, feed, sales management). The user will be restricted to the customer portal."
                      : `Promoting this CUSTOMER account to ${roleTarget.newRole} will grant access to internal farm operations and management tools.`}
                  </AlertDescription>
                </Alert>
              ) : roleTarget.newRole === "ADMIN" ? (
                <Alert className="border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20">
                  <ShieldCheck className="size-4 text-purple-600 dark:text-purple-400" />
                  <AlertTitle className="text-xs font-semibold text-purple-900 dark:text-purple-300">
                    Granting Administrator Access
                  </AlertTitle>
                  <AlertDescription className="text-xs text-purple-800/80 dark:text-purple-300/80">
                    This user will receive full administrative privileges, including managing other staff accounts, configuring system parameters, and inspecting audit trails.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                    Restricting to Staff Access
                  </AlertTitle>
                  <AlertDescription className="text-xs text-amber-800/80 dark:text-amber-300/80">
                    This user will be demoted to Staff. They will retain day-to-day operational recording permissions (production, feed, sales), but will immediately lose access to user administration and settings.
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-[11px] text-muted-foreground">
                This modification will be recorded in the system audit logs under action{" "}
                <code className="text-foreground font-mono bg-muted px-1 py-0.5 rounded">
                  USER_ROLE_CHANGED
                </code>
                .
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUpdatingRole}
              onClick={() => setRoleTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isUpdatingRole}
              onClick={handleConfirmRoleChange}
              className={
                roleTarget?.newRole === "ADMIN"
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : ""
              }
            >
              {isUpdatingRole ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Updating Role...
                </>
              ) : (
                `Confirm ${roleTarget?.newRole === "ADMIN" ? "Promotion" : "Demotion"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Approval Confirmation Dialog */}
      <Dialog
        open={!!approveTarget}
        onOpenChange={(open) => {
          if (!open && !isApprovingCustomer) setApproveTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <UserCheck className="size-4" />
              </div>
              <DialogTitle className="text-base font-semibold">
                Approve Customer Account
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1">
              Grant this customer portal access after verifying their identity.
            </DialogDescription>
          </DialogHeader>

          {approveTarget && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/60">
                <div className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs border border-emerald-200 dark:border-emerald-800">
                  {getInitials(approveTarget.full_name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {approveTarget.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {approveTarget.email || approveTarget.phone || "No contact info"}
                  </p>
                </div>
              </div>

              <Alert className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
                <UserCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                <AlertTitle className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                  Granting Customer Portal Access
                </AlertTitle>
                <AlertDescription className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                  Approving this account will activate {approveTarget.full_name}&apos;s login and allow them
                  to place orders and view invoices through the customer portal. The system will
                  automatically link or create their buyer record in the Customer Directory.
                </AlertDescription>
              </Alert>

              <p className="text-[11px] text-muted-foreground">
                This action will be recorded in audit logs under{" "}
                <code className="text-foreground font-mono bg-muted px-1 py-0.5 rounded">
                  CUSTOMER_APPROVED
                </code>
                .
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isApprovingCustomer}
              onClick={() => setApproveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isApprovingCustomer}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmApproveCustomer}
            >
              {isApprovingCustomer ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Approving...
                </>
              ) : (
                "Approve Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Deactivation Confirmation Dialog */}
      <Dialog
        open={!!deactivateCustomerTarget}
        onOpenChange={(open) => {
          if (!open && !isDeactivatingCustomer) setDeactivateCustomerTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-4" />
              </div>
              <DialogTitle className="text-base font-semibold">
                Deactivate Customer Account
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1">
              Revoke this customer&apos;s portal access until reactivated by an administrator.
            </DialogDescription>
          </DialogHeader>

          {deactivateCustomerTarget && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/60">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
                  {getInitials(deactivateCustomerTarget.full_name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {deactivateCustomerTarget.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {deactivateCustomerTarget.email ||
                      deactivateCustomerTarget.phone ||
                      "No contact info"}
                  </p>
                </div>
              </div>

              <Alert className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
                <AlertTriangle className="size-4 text-destructive" />
                <AlertTitle className="text-xs font-semibold text-destructive">
                  Account Suspension
                </AlertTitle>
                <AlertDescription className="text-xs text-destructive/90">
                  This customer will immediately lose portal access and cannot place new orders.
                  Existing orders and records remain intact. You can re-approve the account at any
                  time.
                </AlertDescription>
              </Alert>

              <p className="text-[11px] text-muted-foreground">
                This action will be recorded in audit logs under{" "}
                <code className="text-foreground font-mono bg-muted px-1 py-0.5 rounded">
                  CUSTOMER_DEACTIVATED
                </code>
                .
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeactivatingCustomer}
              onClick={() => setDeactivateCustomerTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isDeactivatingCustomer}
              onClick={handleConfirmDeactivateCustomer}
            >
              {isDeactivatingCustomer ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Deactivating...
                </>
              ) : (
                "Deactivate Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation Dialog */}
      <Dialog
        open={!!statusTarget}
        onOpenChange={(open) => {
          if (!open && !isUpdatingStatus) {
            setStatusTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "p-2 rounded-full",
                  statusTarget?.newStatus
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {statusTarget?.newStatus ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
              </div>
              <DialogTitle className="text-base font-semibold">
                {statusTarget?.newStatus
                  ? "Activate User Account"
                  : "Deactivate User Account"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1">
              {statusTarget?.newStatus
                ? "Restore application login access for this user."
                : "Suspend application login access for this user."}
            </DialogDescription>
          </DialogHeader>

          {statusTarget && (
            <div className="space-y-4 py-2">
              {/* User Summary Box */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/60">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
                    {getInitials(statusTarget.user.full_name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {statusTarget.user.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {statusTarget.user.email || statusTarget.user.phone || "No contact info"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={statusTarget.user.is_active ? "default" : "secondary"}
                  className={
                    statusTarget.user.is_active
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {statusTarget.user.is_active ? "Currently Active" : "Currently Inactive"}
                </Badge>
              </div>

              {/* Status Consequence Alert */}
              {statusTarget.newStatus ? (
                <Alert className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
                  <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                  <AlertTitle className="text-xs font-semibold text-green-900 dark:text-green-300">
                    Account Activation
                  </AlertTitle>
                  <AlertDescription className="text-xs text-green-800/80 dark:text-green-300/80">
                    Activating this account will allow {statusTarget.user.full_name} to log in and use POULTRY HUB with {statusTarget.user.role} permissions.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
                  <AlertTriangle className="size-4 text-destructive" />
                  <AlertTitle className="text-xs font-semibold text-destructive">
                    Account Suspension
                  </AlertTitle>
                  <AlertDescription className="text-xs text-destructive/90">
                    Deactivating this account will immediately revoke access to POULTRY HUB. The user will be unable to log in until reactivated by an administrator. Existing records, transactions, and audit entries will remain intact.
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-[11px] text-muted-foreground">
                This modification will be recorded in the system audit logs under action{" "}
                <code className="text-foreground font-mono bg-muted px-1 py-0.5 rounded">
                  USER_STATUS_CHANGED
                </code>
                .
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUpdatingStatus}
              onClick={() => setStatusTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusTarget?.newStatus ? "default" : "destructive"}
              disabled={isUpdatingStatus}
              onClick={handleConfirmStatusChange}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Updating Status...
                </>
              ) : statusTarget?.newStatus ? (
                "Activate Account"
              ) : (
                "Deactivate Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
