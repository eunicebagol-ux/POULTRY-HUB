-- Migration 011: Fix Payment RPC Authorization
-- Replaces the dropped `require_staff_or_admin()` with the restored `require_active_user()`

BEGIN;

CREATE OR REPLACE FUNCTION public.record_egg_payment(
  p_sale_id          UUID,
  p_amount           NUMERIC(12,2),
  p_payment_method   TEXT,
  p_payment_date     DATE,
  p_reference_number TEXT DEFAULT NULL,
  p_notes            TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id        TEXT;
  v_payment_id       UUID;
  v_sale_record      RECORD;
  v_total_paid_prior NUMERIC(12,2) := 0;
  v_total_paid_new   NUMERIC(12,2) := 0;
  v_remaining_bal    NUMERIC(12,2) := 0;
  v_new_status       TEXT;
  v_method_enum      public.payment_method;
BEGIN
  -- 1. Authorization: Require active profile
  PERFORM public.require_active_user();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Validate input parameters
  IF p_sale_id IS NULL THEN
    RAISE EXCEPTION 'sale_id is required.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'payment_date is required.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Validate payment method cast
  BEGIN
    v_method_enum := p_payment_method::public.payment_method;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid payment method: %. Must be CASH, BANK_TRANSFER, CHECK, or E_WALLET.', p_payment_method
      USING ERRCODE = 'invalid_parameter_value';
  END;

  -- 3. Lock target egg_sales row using FOR UPDATE to prevent race conditions
  SELECT id, total_amount, payment_status, customer_id, invoice_number
  INTO v_sale_record
  FROM public.egg_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Egg sale with ID % does not exist.', p_sale_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 4. Reject payment on cancelled sales
  IF v_sale_record.payment_status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Cannot record payment for a cancelled sale.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Calculate existing payments server-side from authoritative ledger
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid_prior
  FROM public.payments
  WHERE sale_id = p_sale_id;

  -- 6. Calculate remaining balance server-side
  v_remaining_bal := v_sale_record.total_amount - v_total_paid_prior;

  IF v_remaining_bal <= 0 THEN
    RAISE EXCEPTION 'Sale is already fully paid. No balance remaining.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 7. Reject overpayment
  IF p_amount > v_remaining_bal THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%). Overpayment is not permitted.',
      p_amount, v_remaining_bal
      USING ERRCODE = 'check_violation';
  END IF;

  -- 8. Append payment record
  INSERT INTO public.payments (
    sale_id,
    amount,
    payment_method,
    payment_date,
    reference_number,
    notes,
    recorded_by
  )
  VALUES (
    p_sale_id,
    p_amount,
    v_method_enum,
    p_payment_date,
    NULLIF(TRIM(p_reference_number), ''),
    NULLIF(TRIM(p_notes), ''),
    v_caller_id
  )
  RETURNING id INTO v_payment_id;

  -- 9. Recalculate status based on new authoritative total
  v_total_paid_new := v_total_paid_prior + p_amount;

  IF v_total_paid_new >= v_sale_record.total_amount THEN
    v_new_status := 'PAID';
  ELSIF v_total_paid_new > 0 THEN
    v_new_status := 'PARTIAL';
  ELSE
    v_new_status := 'PENDING';
  END IF;

  -- 10. Update egg_sales status atomically
  UPDATE public.egg_sales
  SET payment_status = v_new_status,
      updated_at = NOW()
  WHERE id = p_sale_id;

  -- 11. Record immutable audit log entry in the SAME transaction
  INSERT INTO public.activity_logs (
    actor_id,
    action,
    entity_table,
    entity_id,
    metadata
  )
  VALUES (
    v_caller_id,
    'RECORD_PAYMENT',
    'payments',
    v_payment_id,
    jsonb_build_object(
      'sale_id', p_sale_id,
      'amount', p_amount,
      'payment_method', p_payment_method,
      'payment_date', p_payment_date,
      'reference_number', NULLIF(TRIM(p_reference_number), ''),
      'previous_paid', v_total_paid_prior,
      'total_paid', v_total_paid_new,
      'remaining_balance', (v_sale_record.total_amount - v_total_paid_new),
      'payment_status', v_new_status,
      'customer_id', v_sale_record.customer_id,
      'invoice_number', v_sale_record.invoice_number
    )
  );

  RETURN v_payment_id;
END;
$$;

-- Revoke public access and grant to authenticated role
REVOKE EXECUTE ON FUNCTION public.record_egg_payment(UUID, NUMERIC, TEXT, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_egg_payment(UUID, NUMERIC, TEXT, DATE, TEXT, TEXT) TO authenticated;

COMMIT;
