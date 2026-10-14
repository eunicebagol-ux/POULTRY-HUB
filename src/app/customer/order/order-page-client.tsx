"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingCart, List, ArrowRight } from "lucide-react";
import { CustomerProductCatalog } from "@/components/customer/customer-product-catalog";
import { CustomerOrderForm } from "@/components/customer/customer-order-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { EggSize, PackagingType } from "@/types";
import type { EggPriceCatalogEntry } from "@/actions/customer-orders";

interface CartItem {
  size: EggSize;
  packaging: PackagingType;
  package_quantity: number;
  quoted_unit_price: number;
}

interface OrderPageClientProps {
  catalog: EggPriceCatalogEntry[];
  catalogError?: string | null;
}

export function OrderPageClient({ catalog, catalogError }: OrderPageClientProps) {
  const [cart, setCart] = React.useState<CartItem[]>([]);

  const handleRemoveItem = (size: EggSize, packaging: PackagingType) => {
    setCart((prev) =>
      prev.filter((c) => !(c.size === size && c.packaging === packaging))
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border/70 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Place an Order
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select egg sizes and packaging options, then review your order before
            submitting. The farm team will confirm your order.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {cart.length > 0 && (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
              <ShoppingCart className="size-3 mr-1" />
              {cart.length} in cart
            </Badge>
          )}
          <Link href="/customer/orders">
            <Button variant="outline" size="sm" className="text-xs h-8">
              <List className="size-3.5 mr-1.5" />
              My Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Catalog error (migration not applied) ────────────────────── */}
      {catalogError && (
        <Alert className="border-amber-500/20 bg-amber-500/5">
          <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
            {catalogError}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Two-column layout: catalog + cart sidebar ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Catalog: 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Available Products
            </h2>
            <p className="text-[10px] text-muted-foreground">
              Prices are indicative. Final pricing confirmed at fulfillment.
            </p>
          </div>
          <CustomerProductCatalog
            catalog={catalog}
            cart={cart}
            onCartChange={setCart}
          />
        </div>

        {/* Cart / Order Summary: 1/3 width, sticky */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShoppingCart className="size-4 text-muted-foreground" />
              Your Cart
            </h2>
            <CustomerOrderForm
              cart={cart}
              onClearCart={() => setCart([])}
              onRemoveItem={handleRemoveItem}
            />
            {cart.length === 0 && (
              <div className="text-center pt-2">
                <Link
                  href="/customer/orders"
                  className="text-xs text-primary hover:underline flex items-center justify-center gap-1"
                >
                  View past orders <ArrowRight className="size-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
