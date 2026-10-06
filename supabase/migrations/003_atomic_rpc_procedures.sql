-- Migration 003: Atomic Business RPC Procedures
-- POULTRY HUB Authoritative Business Logic Layer
--
-- All RPCs in this file:
--   - Are SECURITY DEFINER with pinned search_path
--   - Derive caller identity exclusively from auth.uid()
--   - Use migration 002 helpers for authorization checks
--   - Perform all calculations server-side
--   - Lock affected inventory rows with FOR UPDATE before balance validation
--   - Are fully atomic: all mutations succeed or all roll back
--   - Write an activity_logs record in the same transaction
--   - REVOKE EXECUTE FROM PUBLIC; GRANT to authenticated only

-- ============================================================
-- HELPER: packaging multiplier (used inside this file only)
-- ============================================================

CREATE OR REPLACE FUNCTION public._packaging_multiplier(p_packaging packaging_type)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_packaging
    WHEN 'PIECE'      THEN 1
    WHEN 'TRAY_30'    THEN 30
    WHEN 'CARTON_12'  THEN 12
    WHEN 'BOX_360'    THEN 360
  END;
$$;

REVOKE EXECUTE ON FUNCTION public._packaging_multiplier(packaging_type) FROM PUBLIC;

-- ============================================================
-- RPC 1 — record_egg_production
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_egg_production(
  p_flock_id        UUID,
  p_production_date DATE,
  p_collection_shift TEXT,
  p_total_eggs      INTEGER,
  p_good_eggs       INTEGER,
  p_damaged_eggs    INTEGER,
  p_cracked_eggs    INTEGER,
  p_notes           TEXT,
  -- size breakdown: array of (size, quantity) composite
  p_sizes           JSONB   -- expected: [{"size":"LARGE","quantity":100}, ...]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id       UUID;
  v_production_id   UUID;
  v_size_total      INTEGER := 0;
  v_item            JSONB;
  v_size_val        egg_size;
  v_qty             INTEGER;
BEGIN
  -- 1. Authenticate and authorize
  PERFORM public.require_active_user();
  v_caller_id := auth.uid();

  -- 2. Basic input validation
  IF p_flock_id IS NULL THEN
    RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_production_date IS NULL THEN
    RAISE EXCEPTION 'production_date is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_total_eggs   < 0 THEN RAISE EXCEPTION 'total_eggs cannot be negative.'   USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_good_eggs    < 0 THEN RAISE EXCEPTION 'good_eggs cannot be negative.'    USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_damaged_eggs < 0 THEN RAISE EXCEPTION 'damaged_eggs cannot be negative.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_cracked_eggs < 0 THEN RAISE EXCEPTION 'cracked_eggs cannot be negative.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  IF p_total_eggs <> p_good_eggs + p_damaged_eggs + p_cracked_eggs THEN
    RAISE EXCEPTION 'total_eggs must equal good_eggs + damaged_eggs + cracked_eggs.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_sizes IS NULL OR jsonb_array_length(p_sizes) = 0 THEN
    RAISE EXCEPTION 'At least one egg size breakdown entry is required.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 3. Lock flock row and validate state
  PERFORM id
  FROM public.flocks
  WHERE id = p_flock_id
  FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.flocks
    WHERE id = p_flock_id AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Flock % does not exist or is not ACTIVE.', p_flock_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 4. Validate size breakdown sums to good_eggs
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sizes)
  LOOP
    v_qty := (v_item->>'quantity')::INTEGER;
    IF v_qty < 0 THEN
      RAISE EXCEPTION 'Size quantity cannot be negative.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_size_total := v_size_total + v_qty;
  END LOOP;

  IF v_size_total <> p_good_eggs THEN
    RAISE EXCEPTION 'Sum of egg size quantities (%) must equal good_eggs (%).',
      v_size_total, p_good_eggs USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Insert egg_production record
  INSERT INTO public.egg_production (
    flock_id, production_date, collection_shift,
    total_eggs, good_eggs, damaged_eggs, cracked_eggs,
    notes, created_by
  ) VALUES (
    p_flock_id, p_production_date, p_collection_shift,
    p_total_eggs, p_good_eggs, p_damaged_eggs, p_cracked_eggs,
    p_notes, v_caller_id
  )
  RETURNING id INTO v_production_id;

  -- 6. Insert size breakdown and update inventory atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sizes)
  LOOP
    v_size_val := (v_item->>'size')::egg_size;
    v_qty      := (v_item->>'quantity')::INTEGER;

    -- Insert size breakdown row (UNIQUE constraint prevents duplicates)
    INSERT INTO public.egg_production_sizes (production_id, size, quantity)
    VALUES (v_production_id, v_size_val, v_qty);

    -- Upsert egg_inventory snapshot balance
    INSERT INTO public.egg_inventory (size, stock_pieces, updated_at)
    VALUES (v_size_val, v_qty, NOW())
    ON CONFLICT (size)
    DO UPDATE SET
      stock_pieces = egg_inventory.stock_pieces + EXCLUDED.stock_pieces,
      updated_at   = NOW();

    -- Append ledger transaction
    INSERT INTO public.egg_inventory_transactions (
      size, quantity, transaction_type, reference_id, notes, created_by
    ) VALUES (
      v_size_val, v_qty, 'PRODUCTION', v_production_id, p_notes, v_caller_id
    );
  END LOOP;

  -- 7. Audit log
  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id,
    'RECORD_PRODUCTION',
    'egg_production',
    v_production_id,
    jsonb_build_object(
      'flock_id',       p_flock_id,
      'production_date', p_production_date,
      'total_eggs',     p_total_eggs,
      'good_eggs',      p_good_eggs
    )
  );

  RETURN v_production_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_egg_production(UUID, DATE, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_egg_production(UUID, DATE, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, JSONB) TO authenticated;

-- ============================================================
-- RPC 2 — record_egg_sale
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_egg_sale(
  p_customer_id UUID,
  p_sale_date   DATE,
  p_discount    NUMERIC,
  p_notes       TEXT,
  -- items: [{"egg_size":"LARGE","packaging_type":"TRAY_30","package_quantity":2,"unit_price":150.00}, ...]
  p_items       JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id        UUID;
  v_sale_id          UUID;
  v_item             JSONB;
  v_size             egg_size;
  v_packaging        packaging_type;
  v_pkg_qty          INTEGER;
  v_unit_price       NUMERIC(10,2);
  v_multiplier       INTEGER;
  v_egg_qty          INTEGER;
  v_line_total       NUMERIC(12,2);
  v_subtotal         NUMERIC(12,2) := 0;
  v_total_amount     NUMERIC(12,2);
  v_current_stock    INTEGER;
BEGIN
  -- 1. Authenticate and authorize
  PERFORM public.require_active_user();
  v_caller_id := auth.uid();

  -- 2. Basic validation
  IF p_sale_date IS NULL THEN
    RAISE EXCEPTION 'sale_date is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_discount IS NULL OR p_discount < 0 THEN
    RAISE EXCEPTION 'discount must be >= 0.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sale item is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Validate customer exists if provided
  IF p_customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers WHERE id = p_customer_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Customer % not found or inactive.', p_customer_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 3. Server-side line calculation and discount bounds check
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_size       := (v_item->>'egg_size')::egg_size;
    v_packaging  := (v_item->>'packaging_type')::packaging_type;
    v_pkg_qty    := (v_item->>'package_quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC(10,2);

    IF v_pkg_qty <= 0 THEN
      RAISE EXCEPTION 'package_quantity must be > 0.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_unit_price < 0 THEN
      RAISE EXCEPTION 'unit_price cannot be negative.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_multiplier := public._packaging_multiplier(v_packaging);
    v_line_total := v_pkg_qty * v_unit_price;
    v_subtotal   := v_subtotal + v_line_total;
  END LOOP;

  IF p_discount > v_subtotal THEN
    RAISE EXCEPTION 'Discount (%) cannot exceed subtotal (%).', p_discount, v_subtotal
      USING ERRCODE = 'check_violation';
  END IF;

  v_total_amount := v_subtotal - p_discount;

  -- 4. Lock all affected egg_inventory rows FOR UPDATE (prevent concurrent oversell)
  PERFORM ei.size
  FROM public.egg_inventory ei
  WHERE ei.size IN (
    SELECT DISTINCT (item->>'egg_size')::egg_size
    FROM jsonb_array_elements(p_items) AS item
  )
  FOR UPDATE;

  -- 5. Verify sufficient stock per size
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_size      := (v_item->>'egg_size')::egg_size;
    v_packaging := (v_item->>'packaging_type')::packaging_type;
    v_pkg_qty   := (v_item->>'package_quantity')::INTEGER;
    v_multiplier := public._packaging_multiplier(v_packaging);
    v_egg_qty   := v_pkg_qty * v_multiplier;

    SELECT COALESCE(stock_pieces, 0)
    INTO   v_current_stock
    FROM   public.egg_inventory
    WHERE  size = v_size;

    IF v_current_stock IS NULL OR v_current_stock < v_egg_qty THEN
      RAISE EXCEPTION 'Insufficient inventory for size %. Available: %, Required: %.',
        v_size, COALESCE(v_current_stock, 0), v_egg_qty
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  -- 6. Insert egg_sales record (server-calculated totals only)
  INSERT INTO public.egg_sales (
    customer_id, sale_date, subtotal, discount, total_amount, notes, created_by
  ) VALUES (
    p_customer_id, p_sale_date, v_subtotal, p_discount, v_total_amount, p_notes, v_caller_id
  )
  RETURNING id INTO v_sale_id;

  -- 7. Insert sale items, deduct inventory, write ledger
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_size       := (v_item->>'egg_size')::egg_size;
    v_packaging  := (v_item->>'packaging_type')::packaging_type;
    v_pkg_qty    := (v_item->>'package_quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC(10,2);
    v_multiplier := public._packaging_multiplier(v_packaging);
    v_egg_qty    := v_pkg_qty * v_multiplier;
    v_line_total := v_pkg_qty * v_unit_price;

    INSERT INTO public.egg_sale_items (
      sale_id, size, packaging, package_quantity, total_pieces, unit_price, line_total
    ) VALUES (
      v_sale_id, v_size, v_packaging, v_pkg_qty, v_egg_qty, v_unit_price, v_line_total
    );

    -- Deduct inventory (negative quantity = outflow)
    UPDATE public.egg_inventory
    SET stock_pieces = stock_pieces - v_egg_qty,
        updated_at   = NOW()
    WHERE size = v_size;

    -- Ledger entry
    INSERT INTO public.egg_inventory_transactions (
      size, quantity, transaction_type, reference_id, notes, created_by
    ) VALUES (
      v_size, -v_egg_qty, 'SALE', v_sale_id, p_notes, v_caller_id
    );
  END LOOP;

  -- 8. Audit log
  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id,
    'CREATE_SALE',
    'egg_sales',
    v_sale_id,
    jsonb_build_object(
      'customer_id',   p_customer_id,
      'sale_date',     p_sale_date,
      'subtotal',      v_subtotal,
      'discount',      p_discount,
      'total_amount',  v_total_amount
    )
  );

  RETURN jsonb_build_object(
    'sale_id',      v_sale_id,
    'subtotal',     v_subtotal,
    'discount',     p_discount,
    'total_amount', v_total_amount
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_egg_sale(UUID, DATE, NUMERIC, TEXT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_egg_sale(UUID, DATE, NUMERIC, TEXT, JSONB) TO authenticated;

-- ============================================================
-- RPC 3 — record_feed_consumption
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_feed_consumption(
  p_flock_id        UUID,
  p_feed_type       TEXT,
  p_quantity_kg     NUMERIC,
  p_consumption_date DATE,
  p_notes           TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id       UUID;
  v_consumption_id  UUID;
  v_current_stock   NUMERIC(10,2);
BEGIN
  -- 1. Authorize
  PERFORM public.require_active_user();
  v_caller_id := auth.uid();

  -- 2. Validate inputs
  IF p_flock_id IS NULL THEN
    RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_feed_type IS NULL OR trim(p_feed_type) = '' THEN
    RAISE EXCEPTION 'feed_type is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_quantity_kg IS NULL OR p_quantity_kg <= 0 THEN
    RAISE EXCEPTION 'quantity_kg must be > 0.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_consumption_date IS NULL THEN
    RAISE EXCEPTION 'consumption_date is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 3. Validate active flock
  IF NOT EXISTS (
    SELECT 1 FROM public.flocks WHERE id = p_flock_id AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Flock % does not exist or is not ACTIVE.', p_flock_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 4. Lock feed inventory row
  SELECT current_stock_kg INTO v_current_stock
  FROM public.feed_inventory
  WHERE feed_type = p_feed_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feed type "%" not found in inventory.', p_feed_type
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 5. Sufficient stock check
  IF v_current_stock < p_quantity_kg THEN
    RAISE EXCEPTION 'Insufficient feed stock. Available: % kg, Required: % kg.',
      v_current_stock, p_quantity_kg USING ERRCODE = 'check_violation';
  END IF;

  -- 6. Insert feed_consumption record
  INSERT INTO public.feed_consumption (
    flock_id, feed_type, quantity_kg, consumption_date, notes, created_by
  ) VALUES (
    p_flock_id, p_feed_type, p_quantity_kg, p_consumption_date, p_notes, v_caller_id
  )
  RETURNING id INTO v_consumption_id;

  -- 7. Deduct feed inventory
  UPDATE public.feed_inventory
  SET current_stock_kg = current_stock_kg - p_quantity_kg,
      updated_at       = NOW()
  WHERE feed_type = p_feed_type;

  -- 8. Ledger entry
  INSERT INTO public.feed_inventory_transactions (
    feed_type, quantity_kg, transaction_type, reference_id, notes, created_by
  ) VALUES (
    p_feed_type, -p_quantity_kg, 'CONSUMPTION', v_consumption_id, p_notes, v_caller_id
  );

  -- 9. Audit log
  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id,
    'RECORD_FEED_CONSUMPTION',
    'feed_consumption',
    v_consumption_id,
    jsonb_build_object(
      'flock_id',         p_flock_id,
      'feed_type',        p_feed_type,
      'quantity_kg',      p_quantity_kg,
      'consumption_date', p_consumption_date
    )
  );

  RETURN v_consumption_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_feed_consumption(UUID, TEXT, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_feed_consumption(UUID, TEXT, NUMERIC, DATE, TEXT) TO authenticated;

-- ============================================================
-- RPC 4 — record_feed_stock_intake
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_feed_stock_intake(
  p_feed_type   TEXT,
  p_quantity_kg NUMERIC,
  p_cost_per_kg NUMERIC,
  p_intake_date DATE,
  p_notes       TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_tx_id     UUID;
BEGIN
  -- 1. Authorize — ADMIN only
  PERFORM public.require_admin();
  v_caller_id := auth.uid();

  -- 2. Validate inputs
  IF p_feed_type IS NULL OR trim(p_feed_type) = '' THEN
    RAISE EXCEPTION 'feed_type is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_quantity_kg IS NULL OR p_quantity_kg <= 0 THEN
    RAISE EXCEPTION 'quantity_kg must be > 0.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_cost_per_kg IS NOT NULL AND p_cost_per_kg < 0 THEN
    RAISE EXCEPTION 'cost_per_kg cannot be negative.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 3. Lock / upsert feed_inventory row
  INSERT INTO public.feed_inventory (feed_type, current_stock_kg, cost_per_kg, updated_at)
  VALUES (p_feed_type, p_quantity_kg, COALESCE(p_cost_per_kg, 0), NOW())
  ON CONFLICT (feed_type)
  DO UPDATE SET
    current_stock_kg = feed_inventory.current_stock_kg + EXCLUDED.current_stock_kg,
    cost_per_kg      = COALESCE(EXCLUDED.cost_per_kg, feed_inventory.cost_per_kg),
    updated_at       = NOW();

  -- 4. Ledger entry
  INSERT INTO public.feed_inventory_transactions (
    feed_type, quantity_kg, transaction_type, notes, created_by
  ) VALUES (
    p_feed_type, p_quantity_kg, 'STOCK_RECEIVED', p_notes, v_caller_id
  )
  RETURNING id INTO v_tx_id;

  -- 5. Audit log
  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id,
    'FEED_STOCK_RECEIVED',
    'feed_inventory',
    v_tx_id,
    jsonb_build_object(
      'feed_type',   p_feed_type,
      'quantity_kg', p_quantity_kg,
      'cost_per_kg', p_cost_per_kg,
      'intake_date', p_intake_date
    )
  );

  RETURN v_tx_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_feed_stock_intake(TEXT, NUMERIC, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_feed_stock_intake(TEXT, NUMERIC, NUMERIC, DATE, TEXT) TO authenticated;

-- ============================================================
-- RPC 5 — adjust_egg_inventory
-- ============================================================

CREATE OR REPLACE FUNCTION public.adjust_egg_inventory(
  p_size            egg_size,
  p_adjustment      INTEGER,  -- positive = add, negative = remove
  p_notes           TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id     UUID;
  v_tx_id         UUID;
  v_current_stock INTEGER;
  v_new_stock     INTEGER;
BEGIN
  -- 1. Authorize — ADMIN only
  PERFORM public.require_admin();
  v_caller_id := auth.uid();

  -- 2. Validate
  IF p_size IS NULL THEN
    RAISE EXCEPTION 'egg size is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_adjustment = 0 THEN
    RAISE EXCEPTION 'adjustment quantity cannot be zero.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_notes IS NULL OR trim(p_notes) = '' THEN
    RAISE EXCEPTION 'A reason/notes is required for inventory adjustments.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 3. Lock inventory row
  SELECT stock_pieces INTO v_current_stock
  FROM public.egg_inventory
  WHERE size = p_size
  FOR UPDATE;

  -- Ensure row exists; create with zero balance if not
  IF NOT FOUND THEN
    INSERT INTO public.egg_inventory (size, stock_pieces, updated_at)
    VALUES (p_size, 0, NOW());
    v_current_stock := 0;
  END IF;

  v_new_stock := v_current_stock + p_adjustment;

  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Adjustment would result in negative inventory (current: %, adjustment: %).',
      v_current_stock, p_adjustment USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Apply adjustment
  UPDATE public.egg_inventory
  SET stock_pieces = v_new_stock,
      updated_at   = NOW()
  WHERE size = p_size;

  -- 5. Ledger entry
  INSERT INTO public.egg_inventory_transactions (
    size, quantity, transaction_type, notes, created_by
  ) VALUES (
    p_size, p_adjustment, 'ADJUSTMENT', p_notes, v_caller_id
  )
  RETURNING id INTO v_tx_id;

  -- 6. Audit log
  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id,
    'EGG_INVENTORY_ADJUSTED',
    'egg_inventory',
    v_tx_id,
    jsonb_build_object(
      'size',         p_size,
      'adjustment',   p_adjustment,
      'before',       v_current_stock,
      'after',        v_new_stock,
      'notes',        p_notes
    )
  );

  RETURN v_tx_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adjust_egg_inventory(egg_size, INTEGER, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.adjust_egg_inventory(egg_size, INTEGER, TEXT) TO authenticated;

-- ============================================================
-- RPC 6 — record_flock_mortality
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_flock_mortality(
  p_flock_id          UUID,
  p_quantity          INTEGER,
  p_event_date        DATE,
  p_reason            TEXT,
  p_entry_record_type entry_type DEFAULT 'STANDARD',
  p_reference_entry_id UUID     DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id        UUID;
  v_mortality_id     UUID;
  v_current_birds    INTEGER;
  v_original_qty     INTEGER;
  v_delta            INTEGER;
  v_resulting_birds  INTEGER;
BEGIN
  -- 1. Authorize (STAFF or ADMIN)
  PERFORM public.require_active_user();
  v_caller_id := auth.uid();

  -- 2. Input validation
  IF p_flock_id IS NULL THEN
    RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be > 0.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_event_date IS NULL THEN
    RAISE EXCEPTION 'event_date is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 3. Lock flock row
  SELECT current_bird_count INTO v_current_birds
  FROM public.flocks
  WHERE id = p_flock_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flock % not found.', p_flock_id USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 4. Entry-type specific logic
  IF p_entry_record_type = 'STANDARD' THEN
    v_delta := -p_quantity;

  ELSIF p_entry_record_type = 'CORRECTION_REVERSAL' THEN
    IF p_reference_entry_id IS NULL THEN
      RAISE EXCEPTION 'reference_entry_id is required for CORRECTION_REVERSAL.'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Validate original entry belongs to same flock
    SELECT quantity INTO v_original_qty
    FROM public.flock_mortality
    WHERE id = p_reference_entry_id AND flock_id = p_flock_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reference mortality entry % not found for flock %.', p_reference_entry_id, p_flock_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Prevent double reversal: check no CORRECTION_REVERSAL already references this entry
    IF EXISTS (
      SELECT 1 FROM public.flock_mortality
      WHERE reference_entry_id = p_reference_entry_id
        AND entry_record_type  = 'CORRECTION_REVERSAL'
    ) THEN
      RAISE EXCEPTION 'Mortality entry % has already been reversed. Double-reversal is not permitted.', p_reference_entry_id
        USING ERRCODE = 'check_violation';
    END IF;

    -- A correction restores the original birds removed
    v_delta := p_quantity;

  ELSE
    RAISE EXCEPTION 'Unknown entry_record_type: %', p_entry_record_type
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 5. Validate resulting bird count
  v_resulting_birds := v_current_birds + v_delta;

  IF v_resulting_birds < 0 THEN
    RAISE EXCEPTION 'Operation would result in a negative bird count (current: %, delta: %).',
      v_current_birds, v_delta USING ERRCODE = 'check_violation';
  END IF;

  -- 6. Insert immutable mortality record
  INSERT INTO public.flock_mortality (
    flock_id, quantity, event_date, reason,
    entry_record_type, reference_entry_id, created_by
  ) VALUES (
    p_flock_id, p_quantity, p_event_date, p_reason,
    p_entry_record_type, p_reference_entry_id, v_caller_id
  )
  RETURNING id INTO v_mortality_id;

  -- 7. Update flock bird count
  UPDATE public.flocks
  SET current_bird_count = v_resulting_birds,
      updated_at         = NOW()
  WHERE id = p_flock_id;

  -- 8. Audit log
  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id,
    'RECORD_MORTALITY',
    'flock_mortality',
    v_mortality_id,
    jsonb_build_object(
      'flock_id',           p_flock_id,
      'quantity',           p_quantity,
      'entry_record_type',  p_entry_record_type,
      'reference_entry_id', p_reference_entry_id,
      'birds_before',       v_current_birds,
      'birds_after',        v_resulting_birds
    )
  );

  RETURN v_mortality_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_flock_mortality(UUID, INTEGER, DATE, TEXT, entry_type, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_flock_mortality(UUID, INTEGER, DATE, TEXT, entry_type, UUID) TO authenticated;

-- ============================================================
-- RPC 7 — record_flock_culling
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_flock_culling(
  p_flock_id           UUID,
  p_quantity           INTEGER,
  p_event_date         DATE,
  p_reason             TEXT,
  p_entry_record_type  entry_type DEFAULT 'STANDARD',
  p_reference_entry_id UUID       DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id       UUID;
  v_culling_id      UUID;
  v_current_birds   INTEGER;
  v_original_qty    INTEGER;
  v_delta           INTEGER;
  v_resulting_birds INTEGER;
BEGIN
  -- 1. Authorize (STAFF or ADMIN)
  PERFORM public.require_active_user();
  v_caller_id := auth.uid();

  -- 2. Input validation
  IF p_flock_id IS NULL THEN
    RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be > 0.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_event_date IS NULL THEN
    RAISE EXCEPTION 'event_date is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 3. Lock flock row
  SELECT current_bird_count INTO v_current_birds
  FROM public.flocks
  WHERE id = p_flock_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flock % not found.', p_flock_id USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 4. Entry-type specific logic
  IF p_entry_record_type = 'STANDARD' THEN
    v_delta := -p_quantity;

  ELSIF p_entry_record_type = 'CORRECTION_REVERSAL' THEN
    IF p_reference_entry_id IS NULL THEN
      RAISE EXCEPTION 'reference_entry_id is required for CORRECTION_REVERSAL.'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Validate original entry belongs to same flock
    SELECT quantity INTO v_original_qty
    FROM public.flock_culling
    WHERE id = p_reference_entry_id AND flock_id = p_flock_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reference culling entry % not found for flock %.', p_reference_entry_id, p_flock_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Prevent double reversal
    IF EXISTS (
      SELECT 1 FROM public.flock_culling
      WHERE reference_entry_id = p_reference_entry_id
        AND entry_record_type  = 'CORRECTION_REVERSAL'
    ) THEN
      RAISE EXCEPTION 'Culling entry % has already been reversed. Double-reversal is not permitted.', p_reference_entry_id
        USING ERRCODE = 'check_violation';
    END IF;

    -- A correction restores the birds removed by original culling entry
    v_delta := p_quantity;

  ELSE
    RAISE EXCEPTION 'Unknown entry_record_type: %', p_entry_record_type
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 5. Validate resulting bird count
  v_resulting_birds := v_current_birds + v_delta;

  IF v_resulting_birds < 0 THEN
    RAISE EXCEPTION 'Operation would result in a negative bird count (current: %, delta: %).',
      v_current_birds, v_delta USING ERRCODE = 'check_violation';
  END IF;

  -- 6. Insert immutable culling record
  INSERT INTO public.flock_culling (
    flock_id, quantity, event_date, reason,
    entry_record_type, reference_entry_id, created_by
  ) VALUES (
    p_flock_id, p_quantity, p_event_date, p_reason,
    p_entry_record_type, p_reference_entry_id, v_caller_id
  )
  RETURNING id INTO v_culling_id;

  -- 7. Update flock bird count
  UPDATE public.flocks
  SET current_bird_count = v_resulting_birds,
      updated_at         = NOW()
  WHERE id = p_flock_id;

  -- 8. Audit log
  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id,
    'RECORD_CULLING',
    'flock_culling',
    v_culling_id,
    jsonb_build_object(
      'flock_id',           p_flock_id,
      'quantity',           p_quantity,
      'entry_record_type',  p_entry_record_type,
      'reference_entry_id', p_reference_entry_id,
      'birds_before',       v_current_birds,
      'birds_after',        v_resulting_birds
    )
  );

  RETURN v_culling_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_flock_culling(UUID, INTEGER, DATE, TEXT, entry_type, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_flock_culling(UUID, INTEGER, DATE, TEXT, entry_type, UUID) TO authenticated;
