"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Pencil, Receipt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createExpense, updateExpense } from "@/actions/expenses";
import type { ExpenseRow, SupplierOption } from "@/actions/expenses";
import {
  MANUAL_EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  createExpenseSchema,
  updateExpenseSchema,
} from "@/lib/validations/expenses";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseDialogProps {
  expense?: ExpenseRow;
  suppliers: SupplierOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: boolean;
}

interface FieldErrors {
  expense_date?: string;
  category?: string;
  amount?: string;
  description?: string;
  supplier_id?: string;
}

// ─── Inner Form ───────────────────────────────────────────────────────────────

function InnerExpenseForm({
  expense,
  suppliers,
  onClose,
}: {
  expense?: ExpenseRow;
  suppliers: SupplierOption[];
  onClose: () => void;
}) {
  const isEditing = !!expense;

  // Today's date string in local timezone
  const todayStr = new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD"

  const [expenseDate, setExpenseDate] = React.useState(
    expense?.expense_date ?? todayStr
  );
  const [category, setCategory] = React.useState(expense?.category ?? "");
  const [amount, setAmount] = React.useState(
    expense?.amount ? String(expense.amount) : ""
  );
  const [description, setDescription] = React.useState(
    expense?.description ?? ""
  );
  const [supplierId, setSupplierId] = React.useState(
    expense?.supplier_id ?? ""
  );
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isPending, setIsPending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const amountNum = parseFloat(amount);
    const rawInput = {
      expense_date: expenseDate,
      category,
      amount: isNaN(amountNum) ? undefined : amountNum,
      description: description.trim() || undefined,
      supplier_id: supplierId || null,
    };

    // Client-side Zod parse
    const schema = isEditing ? updateExpenseSchema : createExpenseSchema;
    const parsed = schema.safeParse(rawInput);

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsPending(true);

    let result;
    if (isEditing) {
      result = await updateExpense(expense.id, parsed.data);
    } else {
      result = await createExpense(parsed.data);
    }

    setIsPending(false);

    if (!result.success) {
      toast.error(isEditing ? "Failed to update expense" : "Failed to record expense", {
        description: result.error,
      });
      return;
    }

    toast.success(isEditing ? "Expense updated" : "Expense recorded", {
      description: isEditing
        ? "The expense record has been updated."
        : "The expense has been recorded successfully.",
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-3">
        {/* Expense Date */}
        <div className="space-y-1.5">
          <Label htmlFor="expense-date">Expense Date *</Label>
          <Input
            id="expense-date"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            disabled={isPending}
            max={todayStr}
          />
          {errors.expense_date && (
            <p className="text-[10px] text-destructive">{errors.expense_date}</p>
          )}
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="expense-category">Category *</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v ?? "")}
            disabled={isPending}
          >
            <SelectTrigger id="expense-category" className="text-sm">
              <SelectValue placeholder="Select expense category…" />
            </SelectTrigger>
            <SelectContent>
              {MANUAL_EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {EXPENSE_CATEGORY_LABELS[cat] ?? cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-[10px] text-destructive">{errors.category}</p>
          )}
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <Label htmlFor="expense-amount">Amount (₱) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              ₱
            </span>
            <Input
              id="expense-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="pl-7"
              disabled={isPending}
            />
          </div>
          {errors.amount && (
            <p className="text-[10px] text-destructive">{errors.amount}</p>
          )}
        </div>

        {/* Supplier (optional) */}
        <div className="space-y-1.5">
          <Label htmlFor="expense-supplier">Supplier (Optional)</Label>
          <Select
            value={supplierId || "none"}
            onValueChange={(v) => setSupplierId(v == null || v === "none" ? "" : v)}
            disabled={isPending}
          >
            <SelectTrigger id="expense-supplier" className="text-sm">
              <SelectValue placeholder="No supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Supplier</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.supplier_id && (
            <p className="text-[10px] text-destructive">{errors.supplier_id}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="expense-description">Description (Optional)</Label>
          <Textarea
            id="expense-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief note about this expense…"
            className="h-16 resize-none text-sm"
            maxLength={500}
            disabled={isPending}
          />
          <p className="text-[10px] text-muted-foreground text-right">
            {description.length}/500
          </p>
          {errors.description && (
            <p className="text-[10px] text-destructive">{errors.description}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEditing ? "Save Changes" : "Record Expense"}
        </Button>
      </div>
    </form>
  );
}

// ─── Public Component ─────────────────────────────────────────────────────────

export function ExpenseDialog({
  expense,
  suppliers,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  triggerButton = false,
}: ExpenseDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const isEditing = !!expense;

  return (
    <>
      {triggerButton && (
        <Button size="sm" className="h-8 gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />
          Add Expense
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? (
                <Pencil className="size-4 text-primary" />
              ) : (
                <Receipt className="size-4 text-primary" />
              )}
              {isEditing ? "Edit Expense" : "Record New Expense"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the details of this manual expense record."
                : "Enter the details for a new farm operating expense."}
            </DialogDescription>
          </DialogHeader>

          {open && (
            <InnerExpenseForm
              key={expense?.id ?? "new"}
              expense={expense}
              suppliers={suppliers}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
