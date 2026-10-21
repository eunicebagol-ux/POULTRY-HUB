"use client";

import * as React from "react";
import {
  Search,
  Building2,
  Pencil,
  Power,
  Trash2,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { SupplierLogoAvatar } from "./supplier-logo-avatar";
import { resolveSupplierLogo } from "@/lib/supplier-logos";
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
import {
  toggleSupplierStatus,
  deleteSupplier,
  type SupplierView,
} from "@/actions/suppliers";
import { SupplierDialog } from "@/components/suppliers/supplier-dialog";

interface SupplierTableProps {
  suppliers: SupplierView[];
  isAdmin: boolean;
}

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function SupplierTable({ suppliers, isAdmin }: SupplierTableProps) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  // Editing state
  const [editingSupplier, setEditingSupplier] =
    React.useState<SupplierView | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  // Deletion state
  const [deletingSupplier, setDeletingSupplier] =
    React.useState<SupplierView | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Toggling status state
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // Filtering
  const filteredSuppliers = React.useMemo(() => {
    return suppliers.filter((s) => {
      // Status match
      if (statusFilter === "ACTIVE" && !s.is_active) return false;
      if (statusFilter === "INACTIVE" && s.is_active) return false;

      // Search match
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(query);
        const matchesContact = s.contact_person?.toLowerCase().includes(query);
        const matchesPhone = s.phone?.toLowerCase().includes(query);
        const matchesEmail = s.email?.toLowerCase().includes(query);
        const matchesAddress = s.address?.toLowerCase().includes(query);
        return (
          matchesName ||
          matchesContact ||
          matchesPhone ||
          matchesEmail ||
          matchesAddress
        );
      }

      return true;
    });
  }, [suppliers, statusFilter, search]);

  const handleToggleStatus = async (supplier: SupplierView) => {
    setTogglingId(supplier.id);
    const newStatus = !supplier.is_active;
    const result = await toggleSupplierStatus(supplier.id, newStatus);
    setTogglingId(null);

    if (!result.success) {
      toast.error("Status update failed", {
        description: result.error,
      });
      return;
    }

    toast.success(
      `Supplier ${newStatus ? "activated" : "deactivated"}`,
      {
        description: `"${supplier.name}" is now ${
          newStatus ? "active" : "inactive"
        }.`,
      }
    );
  };

  const handleDelete = async () => {
    if (!deletingSupplier) return;

    setIsDeleting(true);
    const result = await deleteSupplier(deletingSupplier.id);
    setIsDeleting(false);

    if (!result.success) {
      toast.error("Could not delete supplier", {
        description: result.error,
        duration: 5000,
      });
      setDeletingSupplier(null);
      return;
    }

    toast.success("Supplier deleted", {
      description: `"${deletingSupplier.name}" was permanently removed.`,
    });
    setDeletingSupplier(null);
  };

  const activeCount = suppliers.filter((s) => s.is_active).length;
  const inactiveCount = suppliers.length - activeCount;

  return (
    <div className="space-y-4">
      {/* Controls: Search and Filter Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-muted/60 p-1 rounded-lg border border-border/40 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              statusFilter === "ALL"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({suppliers.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              statusFilter === "ACTIVE"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("INACTIVE")}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              statusFilter === "INACTIVE"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Inactive ({inactiveCount})
          </button>
        </div>
      </div>

      {/* Table Card */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/30">
                <TableHead className="font-semibold text-xs py-3">
                  Supplier / Business
                </TableHead>
                <TableHead className="font-semibold text-xs py-3">
                  Contact Person
                </TableHead>
                <TableHead className="font-semibold text-xs py-3">
                  Phone / Email
                </TableHead>
                <TableHead className="font-semibold text-xs py-3 hidden md:table-cell">
                  Address
                </TableHead>
                <TableHead className="font-semibold text-xs py-3 text-center">
                  Status
                </TableHead>
                <TableHead className="font-semibold text-xs py-3 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-40 text-center text-muted-foreground text-xs"
                  >
                    {suppliers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Building2 className="size-8 text-muted-foreground/50" />
                        <p className="font-medium text-sm text-foreground">
                          No suppliers registered yet
                        </p>
                        <p className="text-xs max-w-sm">
                          Register your feed mills, equipment vendors, and farm
                          supplies providers to manage procurement records.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <p className="font-medium text-foreground">
                          No suppliers found
                        </p>
                        <p className="text-xs">
                          Try adjusting your search query or status filter.
                        </p>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => {
                  const isToggling = togglingId === supplier.id;
                  const resolved = resolveSupplierLogo(supplier);

                  return (
                    <TableRow
                      key={supplier.id}
                      className={`text-xs hover:bg-muted/40 transition-colors ${
                        !supplier.is_active ? "opacity-60 bg-muted/10" : ""
                      }`}
                    >
                      {/* Name & Logo Avatar */}
                      <TableCell className="font-medium py-3">
                        <div className="flex items-center gap-3">
                          <SupplierLogoAvatar
                            supplier={supplier}
                            size="md"
                            showStatusBadge
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-sm">
                                {supplier.name}
                              </span>
                              {!supplier.is_active && (
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  (Inactive)
                                </span>
                              )}
                            </div>
                            {resolved.brandName &&
                              resolved.brandName.toLowerCase() !==
                                supplier.name.toLowerCase() && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {resolved.brandName}
                                </p>
                              )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Contact Person */}
                      <TableCell className="py-3 text-muted-foreground">
                        {supplier.contact_person || (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>

                      {/* Phone & Email */}
                      <TableCell className="py-3">
                        <div className="space-y-0.5">
                          {supplier.phone ? (
                            <div className="flex items-center gap-1.5 text-foreground">
                              <Phone className="size-3 text-muted-foreground" />
                              <span>{supplier.phone}</span>
                            </div>
                          ) : null}
                          {supplier.email ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                              <Mail className="size-3 text-muted-foreground" />
                              <span>{supplier.email}</span>
                            </div>
                          ) : null}
                          {!supplier.phone && !supplier.email && (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Address */}
                      <TableCell className="py-3 hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                        {supplier.address ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="size-3 text-muted-foreground shrink-0" />
                            <span className="truncate" title={supplier.address}>
                              {supplier.address}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3 text-center">
                        <Badge
                          variant={supplier.is_active ? "default" : "secondary"}
                          className={`text-[10px] font-medium px-2 py-0.5 ${
                            supplier.is_active
                              ? "bg-green-600/15 text-green-700 dark:text-green-400 hover:bg-green-600/20 border-green-600/20"
                              : "bg-muted text-muted-foreground border-border/40"
                          }`}
                        >
                          {supplier.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Edit Supplier"
                            onClick={() => {
                              setEditingSupplier(supplier);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>

                          {/* Toggle Active Status */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`size-7 ${
                              supplier.is_active
                                ? "text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                                : "text-green-600 hover:text-green-700 hover:bg-green-500/10 dark:text-green-400"
                            }`}
                            title={
                              supplier.is_active
                                ? "Deactivate Supplier"
                                : "Activate Supplier"
                            }
                            disabled={isToggling}
                            onClick={() => handleToggleStatus(supplier)}
                          >
                            <Power className="size-3.5" />
                          </Button>

                          {/* Delete (Admin only) */}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete Supplier (Admin Only)"
                              onClick={() => setDeletingSupplier(supplier)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
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

      {/* Edit Supplier Dialog */}
      {editingSupplier && (
        <SupplierDialog
          supplier={editingSupplier}
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setEditingSupplier(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingSupplier}
        onOpenChange={(open) => {
          if (!open) setDeletingSupplier(null);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              <DialogTitle className="text-base font-semibold">
                Delete Supplier
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-2 space-y-2">
              <span className="block font-medium text-foreground">
                Are you sure you want to delete &ldquo;
                {deletingSupplier?.name}&rdquo;?
              </span>
              <span className="block text-muted-foreground">
                If this supplier has existing feed purchase or expense records,
                deletion will be blocked to preserve financial and procurement
                audit history. We strongly recommend{" "}
                <strong className="text-foreground">deactivating</strong> the
                supplier instead.
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeletingSupplier(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Checking & Deleting..." : "Delete Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
