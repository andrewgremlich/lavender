# Stripe Subscription Setup

## 1. Create a Stripe account and product

1. Go to https://dashboard.stripe.com and create an account
2. In the Stripe dashboard, go to **Products** → **Add product**
3. Create a recurring product (e.g. "Lavender Pro", monthly price)
4. Copy the **Price ID** (starts with `price_`)
5. In **Settings → Billing → Customer portal**, enable the portal and configure it

## 2. Get your API keys

From the Stripe dashboard **Developers → API keys**:
- **Secret key** — starts with `sk_test_` (test) or `sk_live_` (production)

From **Developers → Webhooks**:
- Click **Add endpoint**
- URL: `https://your-domain.com/api/stripe/webhook`
- Events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Copy the **Signing secret** (starts with `whsec_`)

## 3. Local development

Add to `.dev.vars`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

Install the Stripe CLI (https://stripe.com/docs/stripe-cli), then forward webhooks locally:
```bash
stripe listen --forward-to localhost:5173/api/stripe/webhook
```

The CLI prints its own `whsec_` signing secret — use that as `STRIPE_WEBHOOK_SECRET` locally.

Apply the migration:
```bash
pnpm db:migrate:local
```

## 4. Production deployment

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_PRICE_ID
```

Apply the migration to remote:
```bash
pnpm db:migrate:remote
```

## 5. Testing the flow

1. Log in as a non-demo user
2. Go to **Settings → Subscription** and click **Upgrade to Pro**
3. Complete checkout with Stripe test card `4242 4242 4242 4242`
4. You should be redirected back to `/app/settings?checkout=success`
5. Refresh settings — status should show Pro (may take a moment for the webhook to fire)

To test the free-tier limit: create 14 entries in the current calendar month. The 15th save attempt on the entry page will show the upgrade banner.
