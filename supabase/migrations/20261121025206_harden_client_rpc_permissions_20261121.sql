-- SECURITY: the billing quota RPC requires a signed-in user; its body also
-- verifies auth.uid() matches p_owner_id. Do not allow anon to invoke it.
REVOKE EXECUTE ON FUNCTION public.consume_ai_budget(uuid, integer, integer, integer, integer) FROM PUBLIC, anon;

-- This function is invoked by its database trigger, not directly by app clients.
-- Leave the owner and service_role grants untouched.
REVOKE EXECUTE ON FUNCTION public.enroll_account_retention() FROM PUBLIC, anon, authenticated;
