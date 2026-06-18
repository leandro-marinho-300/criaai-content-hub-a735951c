
CREATE POLICY "brand_assets_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'brand-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "brand_assets_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brand-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "brand_assets_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'brand-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "brand_assets_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'brand-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
