"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SUPPORTED_BANK_OPTIONS,
  type SupportedBankOption,
} from "@/lib/validations/bank-transfer-accounts";
import {
  createBankTransferAccount,
  updateBankTransferAccount,
  toggleBankTransferAccountStatus,
  deleteBankTransferAccount,
} from "@/actions/bank-transfer-accounts";
import type { BankTransferAccountView } from "@/types";

interface BankTransferAccountsPanelProps {
  initialAccounts: BankTransferAccountView[];
}

export function BankTransferAccountsPanel({
  initialAccounts,
}: BankTransferAccountsPanelProps) {
  const [accounts, setAccounts] = React.useState<BankTransferAccountView[]>(
    initialAccounts
  );
  const [isPending, startTransition] = useTransition();

  // Dialog states
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] =
    React.useState<BankTransferAccountView | null>(null);
  const [deletingAccountId, setDeletingAccountId] = React.useState<string | null>(
    null
  );

  // Form states for Add/Edit
  const [bankSelect, setBankSelect] =
    React.useState<SupportedBankOption>("BDO");
  const [customBankName, setCustomBankName] = React.useState("");
  const [accountHolderName, setAccountHolderName] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [displayOrder, setDisplayOrder] = React.useState(0);
  const [isActive, setIsActive] = React.useState(true);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Sync initialAccounts if props update
  const [prevInitial, setPrevInitial] = React.useState(initialAccounts);
  if (prevInitial !== initialAccounts) {
    setPrevInitial(initialAccounts);
    setAccounts(initialAccounts);
  }

  const resetForm = () => {
    setBankSelect("BDO");
    setCustomBankName("");
    setAccountHolderName("");
    setAccountNumber("");
    setInstructions("");
    setDisplayOrder(accounts.length);
    setIsActive(true);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const handleOpenEdit = (account: BankTransferAccountView) => {
    setEditingAccount(account);
    const isStandard = SUPPORTED_BANK_OPTIONS.includes(
      account.bank_name as SupportedBankOption
    ) && account.bank_name !== "Other";

    if (isStandard) {
      setBankSelect(account.bank_name as SupportedBankOption);
      setCustomBankName("");
    } else {
      setBankSelect("Other");
      setCustomBankName(account.bank_name);
    }

    setAccountHolderName(account.account_holder_name);
    setAccountNumber(account.account_number);
    setInstructions(account.instructions || "");
    setDisplayOrder(account.display_order);
    setIsActive(account.is_active);
  };

  const handleSaveAdd = () => {
    if (!accountHolderName.trim()) {
      toast.error("Account holder name is required.");
      return;
    }
    if (!accountNumber.trim() || accountNumber.trim().length < 5) {
      toast.error("Account number must be at least 5 characters.");
      return;
    }
    if (bankSelect === "Other" && (!customBankName.trim() || customBankName.trim().length < 2)) {
      toast.error("Please enter a custom bank name (at least 2 characters).");
      return;
    }

    startTransition(async () => {
      const res = await createBankTransferAccount({
        bank_name_select: bankSelect,
        custom_bank_name: customBankName.trim() || undefined,
        account_holder_name: accountHolderName.trim(),
        account_number: accountNumber.trim(),
        instructions: instructions.trim() || undefined,
        is_active: isActive,
        display_order: Number(displayOrder) || 0,
      });

      if (res.success && res.data) {
        toast.success("Bank receiving account created successfully.");
        setAccounts((prev) => [...prev, res.data].sort((a, b) => a.display_order - b.display_order));
        setIsAddOpen(false);
        resetForm();
      } else {
        toast.error("Failed to create bank account.", {
          description: !res.success ? res.error : "Unknown error",
        });
      }
    });
  };

  const handleSaveEdit = () => {
    if (!editingAccount) return;
    if (!accountHolderName.trim()) {
      toast.error("Account holder name is required.");
      return;
    }
    if (!accountNumber.trim() || accountNumber.trim().length < 5) {
      toast.error("Account number must be at least 5 characters.");
      return;
    }
    if (bankSelect === "Other" && (!customBankName.trim() || customBankName.trim().length < 2)) {
      toast.error("Please enter a custom bank name (at least 2 characters).");
      return;
    }

    startTransition(async () => {
      const res = await updateBankTransferAccount({
        id: editingAccount.id,
        bank_name_select: bankSelect,
        custom_bank_name: customBankName.trim() || undefined,
        account_holder_name: accountHolderName.trim(),
        account_number: accountNumber.trim(),
        instructions: instructions.trim() || undefined,
        is_active: isActive,
        display_order: Number(displayOrder) || 0,
      });

      if (res.success && res.data) {
        toast.success("Bank receiving account updated successfully.");
        setAccounts((prev) =>
          prev
            .map((item) => (item.id === res.data.id ? res.data : item))
            .sort((a, b) => a.display_order - b.display_order)
        );
        setEditingAccount(null);
        resetForm();
      } else {
        toast.error("Failed to update bank account.", {
          description: !res.success ? res.error : "Unknown error",
        });
      }
    });
  };

  const handleToggleStatus = (id: string) => {
    startTransition(async () => {
      const res = await toggleBankTransferAccountStatus(id);
      if (res.success && res.data) {
        toast.success(
          res.data.is_active
            ? "Account activated and will now appear at checkout."
            : "Account deactivated and hidden from checkout."
        );
        setAccounts((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, is_active: res.data.is_active } : item
          )
        );
      } else {
        toast.error("Failed to toggle account status.", {
          description: !res.success ? res.error : "Unknown error",
        });
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteBankTransferAccount(id);
      if (res.success) {
        toast.success("Bank account deleted successfully.");
        setAccounts((prev) => prev.filter((item) => item.id !== id));
        setDeletingAccountId(null);
      } else {
        toast.error("Cannot delete bank account.", {
          description: res.error,
        });
        setDeletingAccountId(null);
      }
    });
  };

  const handleCopy = (id: string, num: string) => {
    navigator.clipboard.writeText(num.replace(/[\s-]/g, "") || num);
    setCopiedId(id);
    toast.success("Account number copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-xl flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            Bank Transfer Receiving Accounts
          </CardTitle>
          <CardDescription className="mt-1">
            Configure the farm&apos;s official bank accounts displayed to customers
            during checkout. Only active accounts appear on the checkout page.
          </CardDescription>
        </div>
        <Button
          type="button"
          onClick={handleOpenAdd}
          className="gap-1.5 h-9"
          id="add-bank-account-btn"
        >
          <Plus className="size-4" />
          Add Bank Account
        </Button>
      </CardHeader>

      <CardContent>
        {accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-3">
            <Building2 className="mx-auto size-10 text-muted-foreground/60" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                No bank receiving accounts configured
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add at least one active receiving account so customers can select
                Bank Transfer at checkout and view official deposit instructions.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenAdd}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              Add First Account
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account Holder</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead className="hidden md:table-cell">Instructions</TableHead>
                  <TableHead className="w-[80px] text-center">Order</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={account.is_active}
                          onCheckedChange={() => handleToggleStatus(account.id)}
                          disabled={isPending}
                          id={`toggle-bta-${account.id}`}
                          aria-label={`Toggle status for ${account.bank_name}`}
                        />
                        <Badge
                          variant={account.is_active ? "default" : "secondary"}
                          className={`text-[10px] uppercase font-semibold ${
                            account.is_active
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {account.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-foreground">
                      {account.bank_name}
                    </TableCell>
                    <TableCell className="text-xs text-foreground">
                      {account.account_holder_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{account.account_number}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopy(account.id, account.account_number)}
                          title="Copy account number"
                        >
                          {copiedId === account.id ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[220px] truncate">
                      {account.instructions || "—"}
                    </TableCell>
                    <TableCell className="text-center text-xs tabular-nums text-muted-foreground">
                      {account.display_order}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenEdit(account)}
                          disabled={isPending}
                          id={`edit-bta-${account.id}`}
                          title="Edit account"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                          onClick={() => setDeletingAccountId(account.id)}
                          disabled={isPending}
                          id={`delete-bta-${account.id}`}
                          title="Delete account"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add Account Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              Add Bank Receiving Account
            </DialogTitle>
            <DialogDescription>
              Configure an official bank account for customer payments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-bta-bank">
                Bank Name <span className="text-destructive">*</span>
              </Label>
              <Select
                value={bankSelect}
                onValueChange={(val) => setBankSelect(val as SupportedBankOption)}
              >
                <SelectTrigger id="add-bta-bank">
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_BANK_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bankSelect === "Other" && (
              <div className="space-y-1.5">
                <Label htmlFor="add-bta-custom-bank">
                  Custom Bank Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-bta-custom-bank"
                  placeholder="e.g. Maya Bank, CIMB, GoTyme"
                  value={customBankName}
                  onChange={(e) => setCustomBankName(e.target.value)}
                  maxLength={100}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="add-bta-holder">
                Account Holder Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-bta-holder"
                placeholder="Official business or account holder name"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                maxLength={150}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-bta-number">
                Account Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-bta-number"
                placeholder="e.g. 1234-5678-9012"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="font-mono"
                maxLength={30}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-bta-instructions">Payment Instructions (Optional)</Label>
              <Textarea
                id="add-bta-instructions"
                placeholder="e.g. Include your order ID in the transfer remarks. Screenshot receipt upon completion."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
              <div className="space-y-1.5">
                <Label htmlFor="add-bta-order">Display Order</Label>
                <Input
                  id="add-bta-order"
                  type="number"
                  min={0}
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="flex items-center justify-between pt-5">
                <Label htmlFor="add-bta-active" className="cursor-pointer">
                  Active
                </Label>
                <Switch
                  id="add-bta-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveAdd}
              disabled={isPending}
              id="save-add-bta-btn"
            >
              {isPending ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog
        open={!!editingAccount}
        onOpenChange={(open) => !open && setEditingAccount(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              Edit Bank Receiving Account
            </DialogTitle>
            <DialogDescription>
              Update bank account details or active status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-bta-bank">
                Bank Name <span className="text-destructive">*</span>
              </Label>
              <Select
                value={bankSelect}
                onValueChange={(val) => setBankSelect(val as SupportedBankOption)}
              >
                <SelectTrigger id="edit-bta-bank">
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_BANK_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bankSelect === "Other" && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-bta-custom-bank">
                  Custom Bank Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-bta-custom-bank"
                  placeholder="e.g. Maya Bank, CIMB, GoTyme"
                  value={customBankName}
                  onChange={(e) => setCustomBankName(e.target.value)}
                  maxLength={100}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-bta-holder">
                Account Holder Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-bta-holder"
                placeholder="Official business or account holder name"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                maxLength={150}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-bta-number">
                Account Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-bta-number"
                placeholder="e.g. 1234-5678-9012"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="font-mono"
                maxLength={30}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-bta-instructions">Payment Instructions (Optional)</Label>
              <Textarea
                id="edit-bta-instructions"
                placeholder="e.g. Include your order ID in the transfer remarks."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
              <div className="space-y-1.5">
                <Label htmlFor="edit-bta-order">Display Order</Label>
                <Input
                  id="edit-bta-order"
                  type="number"
                  min={0}
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="flex items-center justify-between pt-5">
                <Label htmlFor="edit-bta-active" className="cursor-pointer">
                  Active
                </Label>
                <Switch
                  id="edit-bta-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingAccount(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveEdit}
              disabled={isPending}
              id="save-edit-bta-btn"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingAccountId}
        onOpenChange={(open) => !open && setDeletingAccountId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" />
              Delete Bank Receiving Account
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this bank receiving account?
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                If customer orders have already submitted payments referencing this
                account, deletion will be blocked to maintain historical payment
                audit integrity. In that case, deactivate the account instead.
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingAccountId(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deletingAccountId && handleDelete(deletingAccountId)}
              disabled={isPending}
              id="confirm-delete-bta-btn"
            >
              {isPending ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
