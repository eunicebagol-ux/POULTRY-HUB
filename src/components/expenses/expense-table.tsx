"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Search,
  Pencil,
  Trash2,
  Receipt,
  AlertTriangle,
  Cpu,
  PenLine,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ExpenseDialog } from "./expense-dialog";
import { deleteExpense } from "@/actions/expenses";
import type { ExpenseRow, SupplierOption } from "@/actions/expenses";
import {
  isSystemCategory,
  EXPENSE_CATEGORY_LABELS,
  ALL_EXPENSE_CATEGORIES,
} from "@/lib/validations/expenses";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseTableProps {
  expenses: ExpenseRow[];
  suppliers: SupplierOption[];
  isAdmin: boolean;
}

type CategoryFilter = "ALL" | (typeof ALL_EXPENSE_CATEGORIES)[number];
type SourceFilter = "ALL" | "MANUAL" | "SYSTEM";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatExpenseDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getEmptyMessage(
  search: string,
  categoryFilter: CategoryFilter,
  sourceFilter: SourceFilter
): string {
  if (search.trim() || categoryFilter !== "ALL" || sourceFilter !== "ALL") {
    return "Try adjusting your search or filters.";
  }
  return "Record your first farm expense using the Add Expense button above. Feed purchase expenses are created automatically when feed stock is received.";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpenseTable({
  expenses,
  suppliers,
  isAdmin,
}: ExpenseTableProps) {
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>("ALL");
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>("ALL");

  const [editingExpense, setEditingExpense] = React.useState<ExpenseRow | null>(null);
  const [isEditOpen, setIsEditOpen] = React.useState(false);

  const [deletingExpense, setDeletingExpense] = React.useState<ExpenseRow | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // ── Derived counts ───────────────────────────────────────────────────────
  const manualCount = expenses.filter((e) => !isSystemCategory(e.category)).length;
  const systemCount = expenses.filter((e) => isSystemCategory(e.category)).length;

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filteredExpenses = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return expenses.filter((exp) => {
      if (sourceFilter === "MANUAL" && isSystemCategory(exp.category)) return false;
      if (sourceFilter === "SYSTEM" && !isSystemCategory(exp.category)) return false;
      if (categoryFilter !== "ALL" && exp.category !== categoryFilter) return false;

      if (q) {
        const catLabel = (EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category).toLowerCase();
        const desc = (exp.description ?? "").toLowerCase();
        const supplierName = (exp.supplier_name ?? "").toLowerCase();
        if (!catLabel.includes(q) && !desc.includes(q) && !supplierName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [expenses, search, categoryFilter, sourceFilter]);

  const filteredTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // ── Delete handler ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deletingExpense) return;
    setIsDeleting(true);
    const result = await deleteExpense(deletingExpense.id);
    setIsDeleting(false);

    if (!result.success) {
      toast.error("Deletion blocked", {
        description: result.error,
        duration: 7000,
      });
      setDeletingExpense(null);
      return;
    }

    toast.success("Expense deleted", {
      description: "The expense record has been permanently removed.",
    });
    setDeletingExpense(null);
  };

  const isFiltered =
    search.trim() !== "" || categoryFilter !== "ALL" || sourceFilter !== "ALL";

  return (
    <div className="space-y-4">
      {/* ── Search & Source Filters ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search description, category, supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-md border border-border/50 text-xs self-start sm:self-auto">
          {(
            [
              { value: "ALL" as SourceFilter, label: `All (${expenses.length})` },
              { value: "MANUAL" as SourceFilter, label: `Manual (${manualCount})` },
              { value: "SYSTEM" as SourceFilter, label: `System (${systemCount})` },
            ]
          ).map((opt) => (
            <Button
              key={opt.value}
              variant={sourceFilter === opt.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setSourceFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Category filter row ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant={categoryFilter === "ALL" ? "secondary" : "ghost"}
          size="sm"
          className="h-6 text-[11px] px-2"
          onClick={() => setCategoryFilter("ALL")}
        >
          All Categories
        </Button>
        {ALL_EXPENSE_CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={categoryFilter === cat ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-[11px] px-2"
            onClick={() => setCategoryFilter(cat)}
          >
            {EXPENSE_CATEGORY_LABELS[cat] ?? cat}
          </Button>
        ))}
      </div>

      {/* ── Filtered total pill ─────────────────────────────────────────────── */}
      {isFiltered && (
        <p className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground">
            {filteredExpenses.length}
          </span>{" "}
          {filteredExpenses.length === 1 ? "expense" : "expenses"} &middot;{" "}
          <span className="font-semibold text-foreground">
            {formatCurrency(filteredTotal)}
          </span>{" "}
          filtered total
        </p>
      )}

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 min-w-[100px]">Date</TableHead>
                  <TableHead className="min-w-[130px]">Category</TableHead>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  <TableHead className="min-w-[130px]">Supplier</TableHead>
                  <TableHead className="text-right min-w-[110px]">Amount</TableHead>
                  <TableHead className="min-w-[90px]">Source</TableHead>
                  {isAdmin && (
                    <TableHead className="text-right pr-6 min-w-[90px]">
                      Actions
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Receipt className="size-10 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">
                          {isFiltered
                            ? "No matching expenses found"
                            : "No expenses recorded yet"}
                        </p>
                        <p className="text-xs text-muted-foreground/80 max-w-sm">
                          {getEmptyMessage(search, categoryFilter, sourceFilter)}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((exp) => {
                    const isSystem = isSystemCategory(exp.category);
                    const catLabel = EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category;

                    return (
                      <TableRow key={exp.id}>
                        {/* Date */}
                        <TableCell className="pl-6 text-xs font-medium text-foreground">
                          {formatExpenseDate(exp.expense_date)}
                        </TableCell>

                        {/* Category */}
                        <TableCell className="text-xs">
                          <span className="font-medium">{catLabel}</span>
                        </TableCell>

                        {/* Description */}
                        <TableCell
                          className="text-xs text-muted-foreground max-w-[220px] truncate"
                          title={exp.description ?? ""}
                        >
                          {exp.description ?? (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>

                        {/* Supplier */}
                        <TableCell className="text-xs text-muted-foreground">
                          {exp.supplier_name ?? (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>

                        {/* Amount */}
                        <TableCell className="text-xs text-right font-semibold tabular-nums">
                          {formatCurrency(exp.amount)}
                        </TableCell>

                        {/* Source Badge */}
                        <TableCell>
                          {isSystem ? (
                            <Badge
                              variant="secondary"
                              className="h-5 text-[10px] gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                            >
                              <Cpu className="size-2.5" />
                              System
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="h-5 text-[10px] gap-1 bg-primary/10 text-primary"
                            >
                              <PenLine className="size-2.5" />
                              Manual
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions — Admin only, manual only */}
                        {isAdmin && (
                          <TableCell className="text-right pr-6">
                            {isSystem ? (
                              <span className="text-[10px] text-muted-foreground/50 italic">
                                Auto
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs px-2"
                                  onClick={() => {
                                    setEditingExpense(exp);
                                    setIsEditOpen(true);
                                  }}
                                  title="Edit expense"
                                >
                                  <Pencil className="size-3.5 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                                  onClick={() => setDeletingExpense(exp)}
                                  title="Delete expense"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Edit Dialog ────────────────────────────────────────────────────── */}
      {isEditOpen && editingExpense && (
        <ExpenseDialog
          expense={editingExpense}
          suppliers={suppliers}
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open);
            if (!open) setEditingExpense(null);
          }}
        />
      )}

      {/* ── Delete Confirmation Dialog ──────────────────────────────────────── */}
      <Dialog
        open={!!deletingExpense}
        onOpenChange={(open) => !open && setDeletingExpense(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              Delete Expense
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-1 text-xs">
              <p>
                Are you sure you want to permanently delete this expense record?
                This action cannot be undone.
              </p>
              {deletingExpense && (
                <div className="bg-muted rounded border border-border/60 p-2.5 text-foreground space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">
                      {formatExpenseDate(deletingExpense.expense_date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-medium">
                      {EXPENSE_CATEGORY_LABELS[deletingExpense.category] ??
                        deletingExpense.category}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-semibold text-destructive">
                      {formatCurrency(deletingExpense.amount)}
                    </span>
                  </div>
                  {deletingExpense.description && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground shrink-0">
                        Description:
                      </span>
                      <span className="font-medium text-right truncate">
                        {deletingExpense.description}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingExpense(null)}
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
