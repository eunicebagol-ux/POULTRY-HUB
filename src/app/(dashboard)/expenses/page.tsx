import {
  Receipt,
  PenLine,
  Cpu,
  TrendingDown,
} from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getExpenses, getActiveSuppliersForExpenses } from "@/actions/expenses";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { isSystemCategory } from "@/lib/validations/expenses";

export const metadata = {
  title: "Farm Expenses — POULTRY HUB",
  description:
    "Record and manage farm operating expenses. Track costs by category, link supplier receipts, and distinguish system-generated from manually entered expenses.",
};

export const revalidate = 0;

export default async function ExpensesPage() {
  const profile = await getCurrentUserProfile();

  if (!profile || !profile.is_active) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-4">
          <Receipt className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Farm Expenses
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your account is pending activation. Please contact an administrator.
        </p>
      </div>
    );
  }

  const isAdmin = profile.role === "ADMIN";

  const [expenseResult, supplierResult] = await Promise.all([
    getExpenses(),
    getActiveSuppliersForExpenses(),
  ]);

  const expenses = expenseResult.success ? (expenseResult.data ?? []) : [];
  const suppliers = supplierResult.success ? (supplierResult.data ?? []) : [];

  // ── KPI Calculations ────────────────────────────────────────────────────
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const manualExpenses = expenses.filter((e) => !isSystemCategory(e.category));
  const systemExpenses = expenses.filter((e) => isSystemCategory(e.category));
  const manualAmount = manualExpenses.reduce((sum, e) => sum + e.amount, 0);
  const systemAmount = systemExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="size-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Farm Expenses
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Track all farm operating costs. Feed purchase expenses are recorded
            automatically when feed stock is received.
          </p>
        </div>
        <ExpenseDialog suppliers={suppliers} triggerButton />
      </div>

      {/* ── KPI Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Expenses */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <TrendingDown className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Total Expenses
              </p>
              <p className="text-xl font-bold tabular-nums">
                {formatCurrency(totalAmount)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {expenses.length} record{expenses.length !== 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Manual Expenses */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <PenLine className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Manual Expenses
              </p>
              <p className="text-xl font-bold tabular-nums">
                {formatCurrency(manualAmount)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {manualExpenses.length} record{manualExpenses.length !== 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* System Expenses */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Cpu className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                System Expenses
              </p>
              <p className="text-xl font-bold tabular-nums">
                {formatCurrency(systemAmount)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {systemExpenses.length} auto-generated
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Active Suppliers */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-green-500/10 text-green-700 dark:text-green-400">
              <Receipt className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Linked Suppliers
              </p>
              <p className="text-xl font-bold tabular-nums">
                {new Set(expenses.map((e) => e.supplier_id).filter(Boolean)).size}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {suppliers.length} active supplier{suppliers.length !== 1 ? "s" : ""} available
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Role Notice (STAFF) ───────────────────────────────────────────── */}
      {!isAdmin && (
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <span className="font-semibold">Staff view:</span> You can record
            new manual expenses. Editing and deleting expense records requires
            Administrator access. Feed purchase expenses are managed
            automatically by the system.
          </p>
        </div>
      )}

      {/* ── Expense Table ─────────────────────────────────────────────────── */}
      <ExpenseTable
        expenses={expenses}
        suppliers={suppliers}
        isAdmin={isAdmin}
      />
    </div>
  );
}
