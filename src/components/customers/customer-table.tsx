"use client";

import * as React from "react";
import {
  Search,
  Users,
  Pencil,
  Power,
  Trash2,
  Phone,
  Mail,
  MapPin,
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
import {
  toggleCustomerStatus,
  deleteCustomer,
  type CustomerView,
} from "@/actions/customers";
import { CustomerDialog } from "@/components/customers/customer-dialog";

interface CustomerTableProps {
  customers: CustomerView[];
  isAdmin: boolean;
}

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function CustomerTable({ customers, isAdmin }: CustomerTableProps) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  // Editing state
  const [editingCustomer, setEditingCustomer] =
    React.useState<CustomerView | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  // Deletion state
  const [deletingCustomer, setDeletingCustomer] =
    React.useState<CustomerView | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Toggling status state
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // Filtering
  const filteredCustomers = React.useMemo(() => {
    return customers.filter((c) => {
      // Status match
      if (statusFilter === "ACTIVE" && !c.is_active) return false;
      if (statusFilter === "INACTIVE" && c.is_active) return false;

      // Search match
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(query);
        const matchesContact = c.contact_person?.toLowerCase().includes(query);
        const matchesPhone = c.phone?.toLowerCase().includes(query);
        const matchesEmail = c.email?.toLowerCase().includes(query);
        const matchesAddress = c.address?.toLowerCase().includes(query);
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
  }, [customers, statusFilter, search]);

  const handleToggleStatus = async (customer: CustomerView) => {
    setTogglingId(customer.id);
    const newStatus = !customer.is_active;
    const result = await toggleCustomerStatus(customer.id, newStatus);
    setTogglingId(null);

    if (!result.success) {
      toast.error("Failed to update status", {
        description: result.error,
      });
      return;
    }

    toast.success(
      newStatus ? "Customer activated" : "Customer deactivated",
      {
        description: `Customer "${customer.name}" is now ${
          newStatus ? "active and eligible for new sales" : "inactive"
        }. Historical sales records remain intact.`,
      }
    );
  };

  const handleDelete = async () => {
    if (!deletingCustomer) return;

    setIsDeleting(true);
    const result = await deleteCustomer(deletingCustomer.id);
    setIsDeleting(false);

    if (!result.success) {
      toast.error("Deletion blocked", {
        description: result.error,
        duration: 6000,
      });
      setDeletingCustomer(null);
      return;
    }

    toast.success("Customer deleted", {
      description: `Customer "${deletingCustomer.name}" has been removed.`,
    });
    setDeletingCustomer(null);
  };

  const activeCount = customers.filter((c) => c.is_active).length;
  const inactiveCount = customers.length - activeCount;

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, contact, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-muted/40 p-1 rounded-md border border-border/50 text-xs">
          <Button
            variant={statusFilter === "ALL" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setStatusFilter("ALL")}
          >
            All ({customers.length})
          </Button>
          <Button
            variant={statusFilter === "ACTIVE" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setStatusFilter("ACTIVE")}
          >
            Active ({activeCount})
          </Button>
          <Button
            variant={statusFilter === "INACTIVE" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setStatusFilter("INACTIVE")}
          >
            Inactive ({inactiveCount})
          </Button>
        </div>
      </div>

      {/* Customer Directory Table */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Customer / Business</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Phone / Email</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-16 text-center"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Users className="size-10 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">
                          {search.trim() || statusFilter !== "ALL"
                            ? "No matching customers found"
                            : "No customers registered yet"}
                        </p>
                        <p className="text-xs text-muted-foreground/80 max-w-sm">
                          {search.trim() || statusFilter !== "ALL"
                            ? "Try adjusting your search query or status filter."
                            : "Add your first egg buyer to begin recording sales."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="pl-6 font-medium text-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {customer.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {customer.contact_person || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="size-3 text-muted-foreground/70" />
                              {customer.phone}
                            </span>
                          )}
                          {customer.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="size-3 text-muted-foreground/70" />
                              {customer.email}
                            </span>
                          )}
                          {!customer.phone && !customer.email && "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={customer.address || ""}>
                        {customer.address ? (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="size-3 text-muted-foreground/70 shrink-0" />
                            {customer.address}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.is_active ? (
                          <Badge
                            variant="secondary"
                            className="h-5 text-[10px] bg-green-500/10 text-green-700 dark:text-green-400"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="h-5 text-[10px] text-muted-foreground"
                          >
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => {
                              setEditingCustomer(customer);
                              setIsEditDialogOpen(true);
                            }}
                            title="Edit customer info"
                          >
                            <Pencil className="size-3.5 mr-1" />
                            Edit
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 text-xs px-2 ${
                              customer.is_active
                                ? "text-amber-600 hover:text-amber-700 dark:text-amber-400"
                                : "text-green-600 hover:text-green-700 dark:text-green-400"
                            }`}
                            onClick={() => handleToggleStatus(customer)}
                            disabled={togglingId === customer.id}
                            title={
                              customer.is_active
                                ? "Deactivate customer (preserves sales history)"
                                : "Activate customer"
                            }
                          >
                            <Power className="size-3.5 mr-1" />
                            {customer.is_active ? "Deactivate" : "Activate"}
                          </Button>

                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                              onClick={() => setDeletingCustomer(customer)}
                              title="Delete customer (Admin only)"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Customer Dialog */}
      {isEditDialogOpen && (
        <CustomerDialog
          customer={editingCustomer}
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setEditingCustomer(null);
          }}
        />
      )}

      {/* Admin Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingCustomer}
        onOpenChange={(open) => !open && setDeletingCustomer(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              Delete Customer
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-1 text-xs">
              <p>
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold text-foreground">
                  {deletingCustomer?.name}
                </span>
                ?
              </p>
              <div className="bg-muted p-2.5 rounded text-muted-foreground border border-border/60">
                <p className="font-medium text-foreground mb-1">
                  Integrity Notice:
                </p>
                <p>
                  If this customer has existing sales invoices, deletion will be
                  blocked by database referential integrity. In that case, please{" "}
                  <strong>Deactivate</strong> the customer instead.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingCustomer(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
