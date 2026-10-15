drop trigger if exists products_activity_log on public.products;
drop trigger if exists invoices_activity_log on public.invoices;
drop trigger if exists store_settings_activity_log on public.store_settings;
drop trigger if exists custom_units_activity_log on public.custom_units;

drop function if exists public.log_shop_activity();
drop table if exists public.activity_log;
