#!/usr/bin/env bash
# Rebuilds the bundles and deploys Edge Functions with the right JWT flag (needs a linked Supabase CLI).
# Usage: yarn deploy:functions [name ...]   (no names deploys all)
set -euo pipefail

cd "$(dirname "$0")/.."

# Called by signed-in users; the gateway verifies the JWT.
JWT_FUNCTIONS=(ai-proxy export-pdf send-email create-checkout-session create-portal-session get-plan-pricing)
# Called by Stripe, Resend, Supabase Auth or cron, which authenticate by signature or shared secret.
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
