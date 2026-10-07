-- Migration 009: Egg Production Date Validation
-- POULTRY HUB — Enforce production_date >= flock.acquisition_date

BEGIN;

CREATE OR REPLACE FUNCTION public.record_egg_production(
  p_flock_id        UUID,
  p_production_date DATE,
  p_collection_shift TEXT,
  p_total_eggs      INTEGER,
  p_good_eggs       INTEGER,
  p_damaged_eggs    INTEGER,
  p_cracked_eggs    INTEGER,
  p_notes           TEXT,
  p_sizes           JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id       TEXT;
  v_production_id   UUID;
  v_size_total      INTEGER := 0;
  v_item            JSONB;
  v_size_val        egg_size;
  v_qty             INTEGER;
  v_flock_status    flock_status;
  v_flock_acq_date  DATE;
BEGIN
  PERFORM public.require_active_user();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege';
  END IF;

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

  SELECT status, acquisition_date INTO v_flock_status, v_flock_acq_date
  FROM public.flocks WHERE id = p_flock_id FOR UPDATE;

  IF v_flock_status IS NULL OR v_flock_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Flock % does not exist or is not ACTIVE.', p_flock_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_production_date < v_flock_acq_date THEN
    RAISE EXCEPTION 'Production date cannot be before flock acquisition date.'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sizes) LOOP
    v_size_val := (v_item->>'size')::egg_size;
    v_qty      := (v_item->>'quantity')::INTEGER;
    IF v_qty < 0 THEN
      RAISE EXCEPTION 'Egg quantity for size % cannot be negative.', v_size_val
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_size_total := v_size_total + v_qty;
  END LOOP;

  IF v_size_total <> p_good_eggs THEN
    RAISE EXCEPTION 'Sum of egg sizes (%) does not equal good_eggs (%).', v_size_total, p_good_eggs
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.egg_production (
    flock_id, production_date, collection_shift,
    total_eggs, good_eggs, damaged_eggs, cracked_eggs,
    notes, created_by
  ) VALUES (
    p_flock_id, p_production_date, p_collection_shift,
    p_total_eggs, p_good_eggs, p_damaged_eggs, p_cracked_eggs,
    p_notes, v_caller_id
  ) RETURNING id INTO v_production_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sizes) LOOP
    v_size_val := (v_item->>'size')::egg_size;
    v_qty      := (v_item->>'quantity')::INTEGER;
    IF v_qty > 0 THEN
      INSERT INTO public.egg_production_sizes (production_id, size, quantity)
      VALUES (v_production_id, v_size_val, v_qty);

      PERFORM id FROM public.egg_inventory WHERE size = v_size_val FOR UPDATE;

      UPDATE public.egg_inventory
      SET stock_pieces = stock_pieces + v_qty, updated_at = NOW()
      WHERE size = v_size_val;

      INSERT INTO public.egg_inventory_transactions (
        size, quantity, transaction_type, reference_id, notes, created_by
      ) VALUES (
        v_size_val, v_qty, 'PRODUCTION', v_production_id,
        'Production collection entry', v_caller_id
      );
    END IF;
  END LOOP;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id, 'RECORD_EGG_PRODUCTION', 'egg_production', v_production_id,
    jsonb_build_object(
      'flock_id', p_flock_id,
      'production_date', p_production_date,
      'total_eggs', p_total_eggs,
      'good_eggs', p_good_eggs
    )
  );

  RETURN v_production_id;
END;
$$;

COMMIT;
