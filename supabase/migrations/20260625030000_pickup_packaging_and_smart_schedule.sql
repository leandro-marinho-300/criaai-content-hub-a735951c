BEGIN;

-- Distinguish the number of packages collected from the number of base units
-- that must enter medication stock.
ALTER TABLE public.medication_pickup_plans
  ADD COLUMN IF NOT EXISTS units_per_package numeric,
  ADD COLUMN IF NOT EXISTS stock_unit text;

UPDATE public.medication_pickup_plans
SET units_per_package = COALESCE(units_per_package, 1),
    stock_unit = COALESCE(NULLIF(stock_unit, ''), unit)
WHERE units_per_package IS NULL OR stock_unit IS NULL OR stock_unit = '';

ALTER TABLE public.medication_pickup_plans
  ALTER COLUMN units_per_package SET DEFAULT 1;

ALTER TABLE public.medication_pickups
  ADD COLUMN IF NOT EXISTS package_quantity numeric,
  ADD COLUMN IF NOT EXISTS package_unit text,
  ADD COLUMN IF NOT EXISTS units_per_package numeric,
  ADD COLUMN IF NOT EXISTS stock_quantity numeric,
  ADD COLUMN IF NOT EXISTS stock_unit text;

UPDATE public.medication_pickups
SET package_quantity = COALESCE(package_quantity, quantity),
    package_unit = COALESCE(NULLIF(package_unit, ''), unit),
    units_per_package = COALESCE(units_per_package, 1),
    stock_quantity = COALESCE(stock_quantity, quantity),
    stock_unit = COALESCE(NULLIF(stock_unit, ''), unit)
WHERE package_quantity IS NULL
   OR package_unit IS NULL
   OR units_per_package IS NULL
   OR stock_quantity IS NULL
   OR stock_unit IS NULL;

CREATE OR REPLACE FUNCTION public.confirm_medication_pickup_v2(
  _plan_id uuid,
  _picked_up_at timestamptz,
  _package_quantity numeric,
  _package_unit text,
  _units_per_package numeric,
  _stock_unit text,
  _lot_number text DEFAULT NULL,
  _expiry_date date DEFAULT NULL,
  _location text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  plan_row public.medication_pickup_plans%ROWTYPE;
  uid uuid := auth.uid();
  lot_id uuid;
  pickup_id uuid;
  next_date date;
  next_month date;
  last_day integer;
  med_name text;
  person_name text;
  event_id uuid;
  stock_quantity numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF _package_quantity IS NULL OR _package_quantity <= 0 THEN
    RAISE EXCEPTION 'Informe uma quantidade de embalagens válida.';
  END IF;
  IF _package_unit IS NULL OR length(trim(_package_unit)) = 0 THEN
    RAISE EXCEPTION 'Informe o tipo de embalagem.';
  END IF;
  IF _units_per_package IS NULL OR _units_per_package <= 0 THEN
    RAISE EXCEPTION 'Informe quantas unidades existem em cada embalagem.';
  END IF;
  IF _stock_unit IS NULL OR length(trim(_stock_unit)) = 0 THEN
    RAISE EXCEPTION 'Informe a unidade usada no estoque.';
  END IF;

  stock_quantity := _package_quantity * _units_per_package;

  SELECT * INTO plan_row
    FROM public.medication_pickup_plans
   WHERE id = _plan_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pickup plan not found'; END IF;
  IF NOT public.is_family_member(plan_row.family_id, uid) THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.stock_lots(
    family_id, medication_id, person_id, quantity, initial_quantity, unit,
    units_per_pack, lot_number, expiry_date, purchase_date, location,
    min_threshold, notes, created_by
  ) VALUES (
    plan_row.family_id, plan_row.medication_id, plan_row.person_id,
    stock_quantity, stock_quantity, trim(_stock_unit), _units_per_package,
    NULLIF(trim(_lot_number), ''), _expiry_date,
    COALESCE(_picked_up_at, now())::date,
    COALESCE(NULLIF(trim(_location), ''), plan_row.pickup_location), 0,
    COALESCE(NULLIF(trim(_notes), ''),
      'Entrada por retirada programada: ' || _package_quantity || ' ' || trim(_package_unit)),
    uid
  ) RETURNING id INTO lot_id;

  INSERT INTO public.stock_movements(
    family_id, medication_id, lot_id, type, quantity, unit,
    quantity_before, quantity_after, person_id, actor, reason
  ) VALUES (
    plan_row.family_id, plan_row.medication_id, lot_id, 'pickup_entry',
    stock_quantity, trim(_stock_unit), 0, stock_quantity,
    plan_row.person_id, uid,
    'Entrada por retirada programada: ' || _package_quantity || ' ' || trim(_package_unit)
  );

  INSERT INTO public.medication_pickups(
    family_id, plan_id, person_id, medication_id, prescription_record_id,
    picked_up_at, quantity, unit, package_quantity, package_unit,
    units_per_package, stock_quantity, stock_unit,
    lot_number, expiry_date, location, notes, stock_lot_id, actor
  ) VALUES (
    plan_row.family_id, plan_row.id, plan_row.person_id, plan_row.medication_id,
    plan_row.prescription_record_id, COALESCE(_picked_up_at, now()),
    _package_quantity, trim(_package_unit), _package_quantity, trim(_package_unit),
    _units_per_package, stock_quantity, trim(_stock_unit),
    NULLIF(trim(_lot_number), ''), _expiry_date,
    COALESCE(NULLIF(trim(_location), ''), plan_row.pickup_location),
    NULLIF(trim(_notes), ''), lot_id, uid
  ) RETURNING id INTO pickup_id;

  IF plan_row.frequency = 'monthly' THEN
    next_month := (date_trunc('month', COALESCE(_picked_up_at, now())::date) + interval '1 month')::date;
    last_day := extract(day from (date_trunc('month', next_month) + interval '1 month - 1 day'))::integer;
    next_date := make_date(
      extract(year from next_month)::integer,
      extract(month from next_month)::integer,
      LEAST(COALESCE(plan_row.day_of_month, extract(day from plan_row.next_pickup_date)::integer), last_day)
    );
  ELSIF plan_row.frequency = 'interval_days' THEN
    next_date := COALESCE(_picked_up_at, now())::date + COALESCE(plan_row.interval_days, 30);
  ELSIF plan_row.frequency = 'weekly' THEN
    next_date := COALESCE(_picked_up_at, now())::date + 7;
  ELSE
    next_date := NULL;
  END IF;

  UPDATE public.medication_pickup_plans
     SET last_pickup_date = COALESCE(_picked_up_at, now())::date,
         next_pickup_date = COALESCE(next_date, next_pickup_date),
         usual_quantity = _package_quantity,
         unit = trim(_package_unit),
         units_per_package = _units_per_package,
         stock_unit = trim(_stock_unit),
         updated_by = uid
   WHERE id = plan_row.id;

  -- The existing trigger recalculates remaining pickups from the actual history.
  IF plan_row.prescription_record_id IS NOT NULL THEN
    UPDATE public.medication_prescription_records
       SET updated_at = now(), updated_by = uid
     WHERE id = plan_row.prescription_record_id;
  END IF;

  IF next_date IS NOT NULL THEN
    SELECT name INTO med_name FROM public.medications WHERE id = plan_row.medication_id;
    SELECT full_name INTO person_name FROM public.people WHERE id = plan_row.person_id;
    IF plan_row.calendar_event_id IS NULL THEN
      INSERT INTO public.calendar_events(
        family_id, person_id, type, title, starts_at, all_day, location,
        status, related_kind, related_id, created_by
      ) VALUES (
        plan_row.family_id, plan_row.person_id, 'retirada_medicamento',
        'Retirar ' || COALESCE(med_name, 'medicamento') || ' — ' || COALESCE(person_name, ''),
        (next_date::text || 'T09:00:00')::timestamp, true, plan_row.pickup_location,
        'agendado', 'medication_pickup_plan', plan_row.id, uid
      ) RETURNING id INTO event_id;
      UPDATE public.medication_pickup_plans
         SET calendar_event_id = event_id
       WHERE id = plan_row.id;
    ELSE
      UPDATE public.calendar_events
         SET starts_at = (next_date::text || 'T09:00:00')::timestamp,
             status = 'agendado', archived_at = NULL,
             location = plan_row.pickup_location
       WHERE id = plan_row.calendar_event_id;
    END IF;
  END IF;

  RETURN pickup_id;
END; $$;

REVOKE ALL ON FUNCTION public.confirm_medication_pickup_v2(
  uuid,timestamptz,numeric,text,numeric,text,text,date,text,text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_medication_pickup_v2(
  uuid,timestamptz,numeric,text,numeric,text,text,date,text,text
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
