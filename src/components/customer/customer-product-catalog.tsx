"use client";

import * as React from "react";
import { ShoppingCart, Plus, Minus, Trash2, Package, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import {
  EGG_SIZE_LABELS,
  PACKAGING_LABELS,
  PACKAGING_MULTIPLIERS,
  DEFAULT_CURRENCY_SYMBOL,
  getEggProductImage,
  getEggProductAltText,
  calculatePackagingPrice,
} from "@/lib/constants";
import type { EggSize, PackagingType, EggType } from "@/types";
import type { EggPriceCatalogEntry } from "@/actions/customer-orders";

interface CartItem {
  size: EggSize;
  packaging: PackagingType;
  package_quantity: number;
  quoted_unit_price: number;
  egg_type?: EggType;
}

interface ProductCatalogProps {
  catalog: EggPriceCatalogEntry[];
  cart: CartItem[];
  onCartChange: (cart: CartItem[]) => void;
}

const PACKAGING_OPTIONS: PackagingType[] = ["PIECE", "TRAY_30", "CARTON_12", "BOX_360"];

function getEffectivePrice(
  entry: EggPriceCatalogEntry,
  packaging: PackagingType
): number {
  return calculatePackagingPrice(packaging, entry.price_per_piece, entry);
}

function formatCurrency(amount: number): string {
  return `${DEFAULT_CURRENCY_SYMBOL}${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CustomerProductCatalog({
  catalog,
  cart,
  onCartChange,
}: ProductCatalogProps) {
  // Extract unique available sizes in display order
  const availableSizes = React.useMemo(() => {
    const seen = new Set<EggSize>();
    const sizes: EggSize[] = [];
    const sorted = [...catalog].sort(
      (a, b) => a.display_order - b.display_order
    );
    for (const item of sorted) {
      if (item.is_available && !seen.has(item.size)) {
        seen.add(item.size);
        sizes.push(item.size);
      }
    }
    return sizes;
  }, [catalog]);

  // Resolves the exact catalog entry for a size and egg type combination (no silent fallback to other egg types)
  const getCatalogEntry = React.useCallback(
    (size: EggSize, eggType: EggType): EggPriceCatalogEntry | undefined => {
      return catalog.find(
        (e) => e.size === size && (e.egg_type ?? "WHITE") === eggType
      );
    },
    [catalog]
  );

  // Selected packaging per size (defaults to TRAY_30 if available)
  const [selectedPackaging, setSelectedPackaging] = React.useState<
    Record<string, PackagingType>
  >(() =>
    Object.fromEntries(availableSizes.map((s) => [s, "TRAY_30" as PackagingType]))
  );

  // Selected egg type (shell color) per size — defaults to "WHITE"
  const [selectedEggType, setSelectedEggType] = React.useState<
    Record<string, EggType>
  >(() =>
    Object.fromEntries(availableSizes.map((s) => [s, "WHITE" as EggType]))
  );

  const [quantities, setQuantities] = React.useState<Record<string, number>>(
    () => Object.fromEntries(availableSizes.map((s) => [s, 1]))
  );

  const cartMap = React.useMemo(() => {
    const map = new Map<string, CartItem>();
    cart.forEach((item) =>
      map.set(`${item.size}:${item.packaging}:${item.egg_type ?? "WHITE"}`, item)
    );
    return map;
  }, [cart]);

  const handleAddToCart = (sizeOrEntry: EggSize | EggPriceCatalogEntry) => {
    const size = typeof sizeOrEntry === "string" ? sizeOrEntry : sizeOrEntry.size;
    const packaging = selectedPackaging[size] || "TRAY_30";
    const eggType = selectedEggType[size] || "WHITE";
    const qty = quantities[size] || 1;
    const activeEntry = getCatalogEntry(size, eggType);
    if (!activeEntry || !activeEntry.is_available) return;

    const price = getEffectivePrice(activeEntry, packaging);
    const key = `${size}:${packaging}:${eggType}`;

    const existingCart = cart.filter(
      (c) => `${c.size}:${c.packaging}:${c.egg_type ?? "WHITE"}` !== key
    );
    onCartChange([
      ...existingCart,
      {
        size,
        packaging,
        package_quantity: qty,
        quoted_unit_price: price,
        egg_type: eggType,
      },
    ]);
  };

  const handleRemoveFromCart = (
    size: EggSize,
    packaging: PackagingType,
    eggType: EggType = "WHITE"
  ) => {
    onCartChange(
      cart.filter(
        (c) =>
          !(
            c.size === size &&
            c.packaging === packaging &&
            (c.egg_type ?? "WHITE") === eggType
          )
      )
    );
  };

  const handleQuantityChange = (size: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [size]: Math.max(1, (prev[size] || 1) + delta),
    }));
  };

  if (availableSizes.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="size-14 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <Package className="size-7" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          No products available yet
        </p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          The farm administrator has not yet published any egg sizes for online ordering.
          Please check back later or contact the farm directly.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {availableSizes.map((size) => {
        const packaging = selectedPackaging[size] || "TRAY_30";
        const eggType = selectedEggType[size] || "WHITE";
        const entry = getCatalogEntry(size, eggType);
        const isEntryAvailable = Boolean(entry && entry.is_available);

        const price = entry ? getEffectivePrice(entry, packaging) : 0;
        const qty = quantities[size] || 1;
        const cartKey = `${size}:${packaging}:${eggType}`;
        const inCart = cartMap.has(cartKey);
        const cartItem = cartMap.get(cartKey);
        const pieces = qty * PACKAGING_MULTIPLIERS[packaging];
        const stockPieces = entry?.stock_pieces ?? 0;
        const stockLabel =
          stockPieces === 0
            ? "Out of stock"
            : stockPieces < 30
            ? "Low stock"
            : `${stockPieces.toLocaleString()} pcs available`;
        const isLowStock = stockPieces > 0 && stockPieces < 30;

        const imageSrc = getEggProductImage(size, eggType);
        const imageAlt = getEggProductAltText(size, eggType);

        return (
          <Card
            key={size}
            className={`group/card border transition-all duration-200 hover:shadow-md pt-0 gap-0 overflow-hidden ${
              inCart
                ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-md"
                : "border-border/60 bg-card"
            }`}
          >
            {/* Egg Tray Product Image */}
            <div className="relative w-full aspect-[4/3] bg-white dark:bg-muted/15 border-b border-border/50 flex items-center justify-center p-3 overflow-hidden">
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-contain p-1.5 transition-transform duration-300 group-hover/card:scale-105"
                priority={(entry?.display_order ?? 99) <= 3}
              />
            </div>

            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    {EGG_SIZE_LABELS[size]}
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {size} Grade
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {inCart && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] py-0.5">
                      In Cart
                    </Badge>
                  )}
                  {!entry && (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] py-0.5">
                      Not Listed
                    </Badge>
                  )}
                  {entry && !entry.is_available && !inCart && (
                    <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-[10px] py-0.5">
                      Unavailable
                    </Badge>
                  )}
                  {entry && isLowStock && !inCart && entry.is_available && (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] py-0.5">
                      Low Stock
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-3">
              {/* Price display */}
              {entry ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatCurrency(price)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      / {PACKAGING_LABELS[packaging]}
                    </span>
                  </div>

                  {/* Per-piece breakdown */}
                  <p className="text-[10px] text-muted-foreground">
                    ≈ {formatCurrency(entry.price_per_piece)} per piece
                    {packaging !== "PIECE" && ` · ${PACKAGING_MULTIPLIERS[packaging]} pcs`}
                  </p>
                </>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-muted-foreground">
                      Not Available
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {eggType === "BROWN" ? "Brown" : "White"} eggs in this size are not listed in the catalog.
                  </p>
                </div>
              )}

              {/* Stock indicator */}
              <div
                className="flex items-center gap-1.5 cursor-help"
                title={
                  entry
                    ? "Current farm inventory level. This is informational only. Actual stock is validated at order fulfillment time by farm staff."
                    : "This egg type has not been added to the product catalog."
                }
              >
                <div
                  className={`size-1.5 rounded-full ${
                    !entry
                      ? "bg-muted-foreground/40"
                      : stockPieces === 0
                      ? "bg-rose-500"
                      : isLowStock
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                />
                <span className="text-[10px] text-muted-foreground">
                  {entry ? stockLabel : "Catalog entry missing"}
                </span>
                <Info className="size-3 text-muted-foreground/50" />
              </div>

              {/* Egg Type selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Egg Type
                </label>
                <Select
                  value={eggType}
                  onValueChange={(val) =>
                    setSelectedEggType((prev) => ({
                      ...prev,
                      [size]: val as EggType,
                    }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHITE" className="text-xs">
                      White Egg
                    </SelectItem>
                    <SelectItem value="BROWN" className="text-xs">
                      Brown Egg
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Packaging selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Packaging
                </label>
                <Select
                  value={packaging}
                  onValueChange={(val) =>
                    setSelectedPackaging((prev) => ({
                      ...prev,
                      [size]: val as PackagingType,
                    }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGING_OPTIONS.map((pkg) => (
                      <SelectItem key={pkg} value={pkg} className="text-xs">
                        {PACKAGING_LABELS[pkg]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity control */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Quantity
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => handleQuantityChange(size, -1)}
                    disabled={!isEntryAvailable || qty <= 1}
                    aria-label={`Decrease quantity for ${EGG_SIZE_LABELS[size]}`}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="flex-1 text-center text-sm font-bold tabular-nums text-foreground">
                    {qty}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => handleQuantityChange(size, 1)}
                    disabled={!isEntryAvailable}
                    aria-label={`Increase quantity for ${EGG_SIZE_LABELS[size]}`}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  {entry ? (
                    <>
                      = {pieces.toLocaleString()} pieces ·{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(qty * price)} est.
                      </span>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </p>
              </div>

              {/* Cart action */}
              {inCart ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="flex-1 text-xs h-8 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleAddToCart(size)}
                    disabled={!isEntryAvailable}
                  >
                    Update Cart
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() =>
                      handleRemoveFromCart(
                        size,
                        cartItem!.packaging,
                        cartItem!.egg_type ?? "WHITE"
                      )
                    }
                    aria-label="Remove from cart"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="w-full text-xs h-8"
                  onClick={() => handleAddToCart(size)}
                  disabled={!isEntryAvailable || stockPieces === 0}
                >
                  <ShoppingCart className="size-3.5 mr-1.5" />
                  {!entry
                    ? "Not Available"
                    : !entry.is_available
                    ? "Unavailable"
                    : stockPieces === 0
                    ? "Out of Stock"
                    : "Add to Cart"}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
