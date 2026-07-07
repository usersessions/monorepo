-- 0017_catalog_reality.sql — restore the seed's own rule (no aspirational catalog rows).
-- 0008 activated all 15 rows "by owner decision"; 12 of them have no adapter code at all,
-- so users could select platforms the extension can never even attempt. Only the 3 pilot
-- platforms with adapter code remain active, and those run in simulation until each
-- passes M6 live verification against the real DOM.

update platforms
set active = false
where id not in ('theresanaiforthat', 'futurepedia', 'uneed');
