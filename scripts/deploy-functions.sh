#!/usr/bin/env bash
# Deploys every Edge Function with the right JWT flag, after regenerating the bundled ones.
#
# Why a script: five functions deploy a GENERATED bundle (see scripts/bundle-functions.mjs), and four must
# skip JWT verification because their caller is not a signed-in user (Stripe, Resend, Supabase Auth, the
# cron). Getting either wrong fails silently in production: a stale bundle, or a 401 from the gateway.
#
# Prerequisites: Supabase CLI logged in and linked (`supabase login` + `supabase link --project-ref <ref>`).
# Usage:         yarn deploy:functions            # all functions
#                yarn deploy:functions ai-proxy   # only the ones named
set -euo pipefail

cd "$(dirname "$0")/.."

# Called by a signed-in user: the gateway verifies the JWT before the function runs.
JWT_FUNCTIONS=(ai-proxy export-pdf send-email create-checkout-session create-portal-session get-plan-pricing)
# Called by a machine that authenticates another way (signature or shared secret).
NO_JWT_FUNCTIONS=(stripe-webhook resend-webhook auth-email-hook discovery-worker)

yarn -s build:functions

wanted=("$@")
should_deploy() {
  [ ${#wanted[@]} -eq 0 ] && return 0
  local name
  for name in "${wanted[@]}"; do [ "$name" = "$1" ] && return 0; done
  return 1
}

for fn in "${JWT_FUNCTIONS[@]}"; do
  should_deploy "$fn" && supabase functions deploy "$fn"
done
for fn in "${NO_JWT_FUNCTIONS[@]}"; do
  should_deploy "$fn" && supabase functions deploy "$fn" --no-verify-jwt
done

echo "Done. Apply pending migrations with: supabase db push"
