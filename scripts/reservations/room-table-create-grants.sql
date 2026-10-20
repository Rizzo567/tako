-- Owner-only API routes enforce tenant scope. Do not grant to anon/authenticated.
GRANT INSERT ON public.rooms TO takomenu_runtime;
GRANT INSERT ON public.tables TO takomenu_runtime;
