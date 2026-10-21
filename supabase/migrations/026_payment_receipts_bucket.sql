-- ============================================================
-- Migration 026: Payment Receipts Storage Bucket and Policies
-- POULTRY HUB - Customer Payment Verification Receipts
-- ============================================================

-- 1. Ensure storage bucket for payment receipts exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-receipts',
  'payment-receipts',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- 2. Read policy for payment receipts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Read Access for Payment Receipts'
  ) THEN
    CREATE POLICY "Read Access for Payment Receipts"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'payment-receipts');
  END IF;
END $$;

-- 3. Upload policy for authenticated users / service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Active Users Upload Payment Receipts'
  ) THEN
    CREATE POLICY "Active Users Upload Payment Receipts"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'payment-receipts'
      AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    );
  END IF;
END $$;

-- 4. Update policy for authenticated users / service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Active Users Update Payment Receipts'
  ) THEN
    CREATE POLICY "Active Users Update Payment Receipts"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'payment-receipts'
      AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    );
  END IF;
END $$;

-- 5. Delete policy for authenticated users / service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Active Users Delete Payment Receipts'
  ) THEN
    CREATE POLICY "Active Users Delete Payment Receipts"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'payment-receipts'
      AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    );
  END IF;
END $$;
