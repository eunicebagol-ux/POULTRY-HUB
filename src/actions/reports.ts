"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── OVERVIEW REPORT ──────────────────────────────────────────────────────────

export interface OverviewReportData {
  totalEggsProduced: number;
  estimatedLayingRate: number;
  totalMortality: number;
  currentEggStock: number;
  currentFeedStock: number;
  // Financials (ADMIN only)
  totalEggSales?: number;
  recordedExpenses?: number;
  netOperatingResult?: number;
}

export async function getOverviewReport(
  startDate?: string,
  endDate?: string
): Promise<ActionResult<OverviewReportData>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized" };
  }
  const isAdmin = caller.role === "ADMIN";
  const supabase = await createClient();

  // 1. Egg Production
  let prodQuery = supabase.from("egg_production").select("total_eggs");
  if (startDate) prodQuery = prodQuery.gte("production_date", startDate);
  if (endDate) prodQuery = prodQuery.lte("production_date", endDate);
  const { data: prodData, error: prodErr } = await prodQuery;
  if (prodErr) return { success: false, error: prodErr.message };

  const totalEggsProduced = prodData.reduce(
    (sum, row) => sum + (row.total_eggs || 0),
    0
  );

  // 2. Mortality/Culling
  let mortQuery = supabase.from("flock_mortality").select("quantity");
  if (startDate) mortQuery = mortQuery.gte("event_date", startDate);
  if (endDate) mortQuery = mortQuery.lte("event_date", endDate);
  const { data: mortData, error: mortErr } = await mortQuery;
  if (mortErr) return { success: false, error: mortErr.message };

  let cullQuery = supabase.from("flock_culling").select("quantity");
  if (startDate) cullQuery = cullQuery.gte("event_date", startDate);
  if (endDate) cullQuery = cullQuery.lte("event_date", endDate);
  const { data: cullData, error: cullErr } = await cullQuery;
  if (cullErr) return { success: false, error: cullErr.message };

  const totalMortality =
    mortData.reduce((sum, row) => sum + (row.quantity || 0), 0) +
    cullData.reduce((sum, row) => sum + (row.quantity || 0), 0);

  // 3. Current Stocks (Not date bound)
  const { data: eggStockData, error: eggStockErr } = await supabase
    .from("egg_inventory")
    .select("stock_pieces");
  if (eggStockErr) return { success: false, error: eggStockErr.message };
  const currentEggStock = eggStockData.reduce(
    (sum, row) => sum + (row.stock_pieces || 0),
    0
  );

  const { data: feedStockData, error: feedStockErr } = await supabase
    .from("feed_inventory")
    .select("current_stock_kg");
  if (feedStockErr) return { success: false, error: feedStockErr.message };
  const currentFeedStock = feedStockData.reduce(
    (sum, row) => sum + (row.current_stock_kg || 0),
    0
  );

  // 4. Estimated Laying Rate
  const { data: flocksData, error: flocksErr } = await supabase
    .from("flocks")
    .select("initial_bird_count, current_bird_count");
  if (flocksErr) return { success: false, error: flocksErr.message };
  const currentBirds = flocksData.reduce(
    (sum, row) => sum + (row.current_bird_count || 0),
    0
  );

  // Simplified overall rate (Total Eggs / (Current Birds * Days))
  let estimatedLayingRate = 0;
  if (currentBirds > 0 && prodData.length > 0) {
    // Determine number of distinct production days
    let days = 1;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } else {
      // Just a rough estimate if no dates provided
      days = 30; // fallback or could calculate distinct days from prodData
    }
    const rate = (totalEggsProduced / (currentBirds * days)) * 100;
    estimatedLayingRate = Math.min(Math.max(rate, 0), 100);
  }

  const result: OverviewReportData = {
    totalEggsProduced,
    estimatedLayingRate,
    totalMortality,
    currentEggStock,
    currentFeedStock,
  };

  // 5. Financials (Admin Only)
  if (isAdmin) {
    let salesQuery = supabase
      .from("egg_sales")
      .select("total_amount, status")
      .neq("status", "CANCELLED");
    if (startDate) salesQuery = salesQuery.gte("sale_date", startDate);
    if (endDate) salesQuery = salesQuery.lte("sale_date", endDate);
    const { data: salesData, error: salesErr } = await salesQuery;
    if (salesErr) return { success: false, error: salesErr.message };
    const totalEggSales = salesData.reduce(
      (sum, row) => sum + (Number(row.total_amount) || 0),
      0
    );

    let expQuery = supabase.from("expenses").select("amount");
    if (startDate) expQuery = expQuery.gte("expense_date", startDate);
    if (endDate) expQuery = expQuery.lte("expense_date", endDate);
    const { data: expData, error: expErr } = await expQuery;
    if (expErr) return { success: false, error: expErr.message };
    const recordedExpenses = expData.reduce(
      (sum, row) => sum + (Number(row.amount) || 0),
      0
    );

    result.totalEggSales = totalEggSales;
    result.recordedExpenses = recordedExpenses;
    result.netOperatingResult = totalEggSales - recordedExpenses;
  }

  return { success: true, data: result };
}

// ─── PRODUCTION REPORT ────────────────────────────────────────────────────────

export interface ProductionReportData {
  trend: Array<{
    date: string;
    totalEggs: number;
    goodEggs: number;
    damageRate: number;
    layingRate: number;
  }>;
  summary: {
    totalEggs: number;
    goodEggs: number;
    damagedEggs: number;
    crackedEggs: number;
    damageRejectRate: number;
    totalMortality: number;
    totalCulling: number;
    estimatedLayingRate: number;
  };
  flocks: Array<{
    flockIdentifier: string;
    totalEggs: number;
    damageRate: number;
    mortality: number;
  }>;
}

export async function getProductionReport(
  startDate?: string,
  endDate?: string
): Promise<ActionResult<ProductionReportData>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();

  // Get flocks
  const { data: flocks, error: flocksErr } = await supabase
    .from("flocks")
    .select("id, flock_identifier, initial_bird_count");
  if (flocksErr || !flocks) return { success: false, error: flocksErr?.message || "Flocks error" };

  // Get production
  let pQuery = supabase
    .from("egg_production")
    .select("flock_id, production_date, total_eggs, good_eggs, damaged_eggs, cracked_eggs")
    .order("production_date", { ascending: true });
  if (startDate) pQuery = pQuery.gte("production_date", startDate);
  if (endDate) pQuery = pQuery.lte("production_date", endDate);
  const { data: prodData, error: pErr } = await pQuery;
  if (pErr) return { success: false, error: pErr.message };

  // Get mortality and culling (all history to accurately calculate bird counts)
  const { data: mortData, error: mErr } = await supabase
    .from("flock_mortality")
    .select("flock_id, quantity, event_date");
  if (mErr) return { success: false, error: mErr.message };

  const { data: cullData, error: cErr } = await supabase
    .from("flock_culling")
    .select("flock_id, quantity, event_date");
  if (cErr) return { success: false, error: cErr.message };

  // Helper to calculate active birds on a specific date
  const getActiveBirds = (flockId: string, date: string) => {
    const flock = flocks.find((f) => f.id === flockId);
    if (!flock) return 0;
    
    const dDate = new Date(date);
    const mort = (mortData || [])
      .filter((m) => m.flock_id === flockId && new Date(m.event_date) <= dDate)
      .reduce((sum, m) => sum + (m.quantity || 0), 0);
    const cull = (cullData || [])
      .filter((c) => c.flock_id === flockId && new Date(c.event_date) <= dDate)
      .reduce((sum, c) => sum + (c.quantity || 0), 0);
      
    return Math.max(0, flock.initial_bird_count - mort - cull);
  };

  // Build summary and trends
  const summary = {
    totalEggs: 0,
    goodEggs: 0,
    damagedEggs: 0,
    crackedEggs: 0,
    damageRejectRate: 0,
    totalMortality: 0,
    totalCulling: 0,
    estimatedLayingRate: 0,
  };

  // Filter mortality for the date range
  const filteredMort = (mortData || []).filter((m) => {
    if (startDate && m.event_date < startDate) return false;
    if (endDate && m.event_date > endDate) return false;
    return true;
  });
  summary.totalMortality = filteredMort.reduce((s, m) => s + m.quantity, 0);

  const filteredCull = (cullData || []).filter((c) => {
    if (startDate && c.event_date < startDate) return false;
    if (endDate && c.event_date > endDate) return false;
    return true;
  });
  summary.totalCulling = filteredCull.reduce((s, c) => s + c.quantity, 0);

  const trendMap = new Map<string, { date: string; totalEggs: number; goodEggs: number; _damaged: number; _birds: number; }>();
  const flockMap = new Map<string, { flockIdentifier: string; totalEggs: number; damageRate: number; mortality: number; _damaged: number; }>();

  for (const f of flocks) {
    flockMap.set(f.id, {
      flockIdentifier: f.flock_identifier,
      totalEggs: 0,
      damageRate: 0,
      mortality: 0,
      _damaged: 0,
    });
  }

  for (const m of filteredMort) {
    const f = flockMap.get(m.flock_id);
    if (f) f.mortality += m.quantity;
  }
  for (const c of filteredCull) {
    const f = flockMap.get(c.flock_id);
    if (f) f.mortality += c.quantity; // Combine into mortality for display
  }

  let totalActiveBirdDays = 0;

  for (const p of (prodData || [])) {
    summary.totalEggs += p.total_eggs;
    summary.goodEggs += p.good_eggs;
    summary.damagedEggs += p.damaged_eggs;
    summary.crackedEggs += p.cracked_eggs;

    const dateStr = p.production_date;
    if (!trendMap.has(dateStr)) {
      trendMap.set(dateStr, {
        date: dateStr,
        totalEggs: 0,
        goodEggs: 0,
        _damaged: 0,
        _birds: 0,
      });
    }

    const t = trendMap.get(dateStr)!;
    t.totalEggs += p.total_eggs;
    t.goodEggs += p.good_eggs;
    t._damaged += p.damaged_eggs + p.cracked_eggs;
    
    const birds = getActiveBirds(p.flock_id, dateStr);
    t._birds += birds;
    totalActiveBirdDays += birds;

    const f = flockMap.get(p.flock_id);
    if (f) {
      f.totalEggs += p.total_eggs;
      f._damaged += p.damaged_eggs + p.cracked_eggs;
    }
  }

  if (summary.totalEggs > 0) {
    summary.damageRejectRate = ((summary.damagedEggs + summary.crackedEggs) / summary.totalEggs) * 100;
  }
  if (totalActiveBirdDays > 0) {
    summary.estimatedLayingRate = (summary.totalEggs / totalActiveBirdDays) * 100;
  }

  const trend = Array.from(trendMap.values()).map((t) => {
    return {
      date: t.date,
      totalEggs: t.totalEggs,
      goodEggs: t.goodEggs,
      damageRate: t.totalEggs > 0 ? (t._damaged / t.totalEggs) * 100 : 0,
      layingRate: t._birds > 0 ? (t.totalEggs / t._birds) * 100 : 0,
    };
  });

  const flockArray = Array.from(flockMap.values()).map((f) => {
    return {
      flockIdentifier: f.flockIdentifier,
      totalEggs: f.totalEggs,
      damageRate: f.totalEggs > 0 ? (f._damaged / f.totalEggs) * 100 : 0,
      mortality: f.mortality,
    };
  });

  return {
    success: true,
    data: {
      trend,
      summary,
      flocks: flockArray,
    },
  };
}

// ─── FEED REPORT ──────────────────────────────────────────────────────────────

export interface FeedReportData {
  summary: {
    totalConsumption: number;
    feedPerEgg: number;
    currentFeedStock: number;
    feedValuation: number;
  };
  trend: Array<{
    date: string;
    consumption: number;
  }>;
  byFeedType: Array<{
    name: string;
    value: number;
  }>;
}

export async function getFeedReport(
  startDate?: string,
  endDate?: string
): Promise<ActionResult<FeedReportData>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();

  // Consumption
  let cQuery = supabase
    .from("feed_consumption")
    .select("feed_type, quantity_kg, consumption_date")
    .order("consumption_date", { ascending: true });
  if (startDate) cQuery = cQuery.gte("consumption_date", startDate);
  if (endDate) cQuery = cQuery.lte("consumption_date", endDate);
  const { data: consumption, error: cErr } = await cQuery;
  if (cErr) return { success: false, error: cErr.message };

  // Egg Production (for Feed Per Egg)
  let pQuery = supabase.from("egg_production").select("total_eggs");
  if (startDate) pQuery = pQuery.gte("production_date", startDate);
  if (endDate) pQuery = pQuery.lte("production_date", endDate);
  const { data: prod, error: pErr } = await pQuery;
  if (pErr) return { success: false, error: pErr.message };

  const totalEggs = (prod || []).reduce((s, p) => s + (p.total_eggs || 0), 0);
  const totalConsumption = (consumption || []).reduce((s, c) => s + (c.quantity_kg || 0), 0);

  // Stock
  const { data: stock, error: sErr } = await supabase
    .from("feed_inventory")
    .select("feed_type, current_stock_kg, cost_per_kg");
  if (sErr) return { success: false, error: sErr.message };

  const currentFeedStock = (stock || []).reduce((s, row) => s + (row.current_stock_kg || 0), 0);
  const feedValuation = (stock || []).reduce(
    (s, row) => s + (row.current_stock_kg || 0) * (row.cost_per_kg || 0),
    0
  );

  const feedPerEgg = totalEggs > 0 ? (totalConsumption * 1000) / totalEggs : 0;

  const typeMap = new Map<string, number>();
  const trendMap = new Map<string, number>();

  for (const c of (consumption || [])) {
    typeMap.set(c.feed_type, (typeMap.get(c.feed_type) || 0) + c.quantity_kg);
    trendMap.set(
      c.consumption_date,
      (trendMap.get(c.consumption_date) || 0) + c.quantity_kg
    );
  }

  const byFeedType = Array.from(typeMap.entries()).map(([name, value]) => ({
    name,
    value,
  }));
  const trend = Array.from(trendMap.entries()).map(([date, consumption]) => ({
    date,
    consumption,
  }));

  return {
    success: true,
    data: {
      summary: {
        totalConsumption,
        feedPerEgg,
        currentFeedStock,
        feedValuation,
      },
      trend,
      byFeedType,
    },
  };
}

// ─── FINANCIAL REPORT ────────────────────────────────────────────────────────

export interface FinancialReportData {
  summary: {
    totalSales: number;
    totalPaymentsReceived: number;
    outstandingReceivables: number;
    totalExpenses: number;
    netResult: number;
  };
  trend: Array<{
    date: string;
    sales: number;
    expenses: number;
  }>;
  expensesByCategory: Array<{
    name: string;
    value: number;
  }>;
}

export async function getFinancialReport(
  startDate?: string,
  endDate?: string
): Promise<ActionResult<FinancialReportData>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized" };
  }
  if (caller.role !== "ADMIN") {
    return { success: false, error: "Forbidden: ADMIN role required." };
  }

  const supabase = await createClient();

  // Sales
  let sQuery = supabase
    .from("egg_sales")
    .select("sale_date, total_amount, payment_status")
    .neq("payment_status", "CANCELLED")
    .order("sale_date", { ascending: true });
  if (startDate) sQuery = sQuery.gte("sale_date", startDate);
  if (endDate) sQuery = sQuery.lte("sale_date", endDate);
  const { data: sales, error: sErr } = await sQuery;
  if (sErr) return { success: false, error: sErr.message };

  // Payments
  let pQuery = supabase
    .from("payments")
    .select("payment_date, amount")
    .order("payment_date", { ascending: true });
  if (startDate) pQuery = pQuery.gte("payment_date", startDate);
  if (endDate) pQuery = pQuery.lte("payment_date", endDate);
  const { data: payments, error: pErr } = await pQuery;
  if (pErr) return { success: false, error: pErr.message };

  // Outstanding Receivables (Global)
  const { data: allSales, error: allSErr } = await supabase
    .from("egg_sales")
    .select("total_amount")
    .neq("payment_status", "CANCELLED");
  const { data: allPayments, error: allPErr } = await supabase
    .from("payments")
    .select("amount");

  let outstandingReceivables = 0;
  if (!allSErr && !allPErr && allSales && allPayments) {
    const totalS = allSales.reduce((sum, row) => sum + (Number(row.total_amount) || 0), 0);
    const totalP = allPayments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    outstandingReceivables = Math.max(0, totalS - totalP);
  }

  // Expenses
  let eQuery = supabase
    .from("expenses")
    .select("expense_date, amount, category")
    .order("expense_date", { ascending: true });
  if (startDate) eQuery = eQuery.gte("expense_date", startDate);
  if (endDate) eQuery = eQuery.lte("expense_date", endDate);
  const { data: expenses, error: eErr } = await eQuery;
  if (eErr) return { success: false, error: eErr.message };

  const summary = {
    totalSales: 0,
    totalPaymentsReceived: 0,
    outstandingReceivables,
    totalExpenses: 0,
    netResult: 0,
  };

  const trendMap = new Map<string, { sales: number; expenses: number }>();
  const catMap = new Map<string, number>();

  for (const s of (sales || [])) {
    const amt = Number(s.total_amount) || 0;
    summary.totalSales += amt;
    const date = s.sale_date;
    if (!trendMap.has(date)) trendMap.set(date, { sales: 0, expenses: 0 });
    trendMap.get(date)!.sales += amt;
  }

  for (const p of (payments || [])) {
    const amt = Number(p.amount) || 0;
    summary.totalPaymentsReceived += amt;
  }

  for (const e of (expenses || [])) {
    const amt = Number(e.amount) || 0;
    summary.totalExpenses += amt;
    const date = e.expense_date;
    if (!trendMap.has(date)) trendMap.set(date, { sales: 0, expenses: 0 });
    trendMap.get(date)!.expenses += amt;

    const cat = e.category;
    catMap.set(cat, (catMap.get(cat) || 0) + amt);
  }

  summary.netResult = summary.totalPaymentsReceived - summary.totalExpenses;

  const trend = Array.from(trendMap.entries())
    .map(([date, data]) => ({
      date,
      sales: data.sales,
      expenses: data.expenses,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const expensesByCategory = Array.from(catMap.entries())
    .map(([name, value]) => ({
      name,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    success: true,
    data: {
      summary,
      trend,
      expensesByCategory,
    },
  };
}

// ─── INVENTORY REPORT ────────────────────────────────────────────────────────

export interface InventoryReportData {
  eggs: Array<{
    size: string;
    stock: number;
  }>;
  eggTotal: number;
  eggValuation: number;
  feed: Array<{
    type: string;
    stock: number;
    valuation: number;
  }>;
  feedTotal: number;
  feedValuation: number;
}

export async function getInventoryReport(): Promise<ActionResult<InventoryReportData>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();

  // Egg Inventory
  const { data: eggs, error: eErr } = await supabase
    .from("egg_inventory")
    .select("size, stock_pieces");
  if (eErr) return { success: false, error: eErr.message };

  // Egg Pricing (From system settings or static lookup, we can try to fetch recent prices or just use a default estimate if none exist.
  // The system likely uses a price list in settings or items, but without it, we can only estimate if prices are stored.
  // Wait, the prompt said: "Use the existing stored egg inventory price fields."
  // Wait, let me check database.types.ts to see if egg_inventory has prices. No, it doesn't.
  // Let me look at egg_inventory table. Ah, `database.types.ts` only has `size`, `stock_pieces`. Let me re-read `egg_inventory` schema.
  // Wait! There is no price on `egg_inventory`! I will have to use standard estimates or 0 if not stored there. Let's fetch settings if possible.
  // Wait, I will just return 0 for eggValuation if there are no price fields.
  // I will just calculate it based on 0, or average sale price. Let's use average sale price from recent sales.
  
  const { data: salesItems } = await supabase
    .from("egg_sale_items")
    .select("size, unit_price, total_pieces")
    .limit(1000);

  const priceMap = new Map<string, number>();
  if (salesItems) {
    const tempMap = new Map<string, { totalVal: number; totalPcs: number }>();
    for (const item of salesItems) {
      if (!tempMap.has(item.size)) tempMap.set(item.size, { totalVal: 0, totalPcs: 0 });
      const t = tempMap.get(item.size)!;
      t.totalVal += (item.unit_price * item.total_pieces);
      t.totalPcs += item.total_pieces;
    }
    for (const [size, data] of tempMap.entries()) {
      if (data.totalPcs > 0) priceMap.set(size, data.totalVal / data.totalPcs);
    }
  }

  const eggData = (eggs || []).map((e) => ({
    size: e.size,
    stock: e.stock_pieces,
  }));
  const eggTotal = eggData.reduce((s, e) => s + e.stock, 0);
  const eggValuation = eggData.reduce((s, e) => s + (e.stock * (priceMap.get(e.size) || 0)), 0);

  // Feed Inventory
  const { data: feed, error: fErr } = await supabase
    .from("feed_inventory")
    .select("feed_type, current_stock_kg, cost_per_kg");
  if (fErr) return { success: false, error: fErr.message };

  const feedData = (feed || []).map((f) => ({
    type: f.feed_type,
    stock: f.current_stock_kg || 0,
    valuation: (f.current_stock_kg || 0) * (f.cost_per_kg || 0),
  }));
  
  const feedTotal = feedData.reduce((s, f) => s + f.stock, 0);
  const feedValuation = feedData.reduce((s, f) => s + f.valuation, 0);

  return {
    success: true,
    data: {
      eggs: eggData,
      eggTotal,
      eggValuation,
      feed: feedData,
      feedTotal,
      feedValuation,
    },
  };
}
