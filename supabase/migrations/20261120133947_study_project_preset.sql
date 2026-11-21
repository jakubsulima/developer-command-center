alter table public.areas
  drop constraint areas_preset_check,
  add constraint areas_preset_check check (preset in ('standard', 'reading', 'study'));

alter table public.project_categories
  drop constraint project_categories_default_preset_check,
  add constraint project_categories_default_preset_check
    check (default_preset in ('standard', 'reading', 'study'));
