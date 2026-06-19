
CREATE POLICY "piece_assets_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'piece-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "piece_assets_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'piece-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "piece_assets_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'piece-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "piece_assets_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'piece-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
