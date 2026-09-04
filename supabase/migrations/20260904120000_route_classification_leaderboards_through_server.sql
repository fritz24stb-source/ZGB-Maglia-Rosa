-- Feature flags are evaluated by the application server. Prevent clients from
-- bypassing them by calling the security-definer leaderboard RPCs directly.
revoke execute on function public.get_ciclamino_leaderboard(uuid)
from anon, authenticated;
revoke execute on function public.get_azzurra_leaderboard(uuid)
from anon, authenticated;

grant execute on function public.get_ciclamino_leaderboard(uuid)
to service_role;
grant execute on function public.get_azzurra_leaderboard(uuid)
to service_role;
