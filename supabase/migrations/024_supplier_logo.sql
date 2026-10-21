-- ============================================================
-- Migration 024: Supplier Logo Column and Storage Policies
-- POULTRY HUB - Supplier Directory Verified Logos & Upload Support
-- ============================================================

-- 1. Add logo_url column to suppliers table
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Configure public storage bucket for supplier-logos (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-logos',
  'supplier-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];

-- 3. Public read policy for supplier-logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for Supplier Logos'
  ) THEN
    CREATE POLICY "Public Access for Supplier Logos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'supplier-logos');
  END IF;
END $$;

-- 4. Upload policy for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Active Users Upload Supplier Logos'
  ) THEN
    CREATE POLICY "Active Users Upload Supplier Logos"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'supplier-logos'
      AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    );
  END IF;
END $$;

-- 5. Update policy for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Active Users Update Supplier Logos'
  ) THEN
    CREATE POLICY "Active Users Update Supplier Logos"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'supplier-logos'
      AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    );
  END IF;
END $$;

-- 6. Delete policy for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Active Users Delete Supplier Logos'
  ) THEN
    CREATE POLICY "Active Users Delete Supplier Logos"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'supplier-logos'
      AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    );
  END IF;
END $$;
