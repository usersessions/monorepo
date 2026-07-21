-- Migration: add billing fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS videos_used_this_month INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS videos_limit_this_month INTEGER DEFAULT 2;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS overage_videos_this_month INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS overage_cost_this_month INTEGER DEFAULT 0; -- cents
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_reset_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paystack_email_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT false;

-- Credit transactions (audit trail)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('free_allocation', 'plan_renewal', 'overage_charge', 'trial_grant', 'bonus', 'refund')),
  videos_amount INTEGER NOT NULL, -- positive = added, negative = used
  videos_balance_after INTEGER NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Overage charges (separate from subscriptions)
CREATE TABLE IF NOT EXISTS overage_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  videos_count INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL, -- $3.00 per video
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'waived')),
  paystack_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Monthly usage snapshots (for analytics)
CREATE TABLE IF NOT EXISTS monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL, -- "2026-07"
  plan TEXT NOT NULL,
  videos_generated INTEGER DEFAULT 0,
  videos_failed INTEGER DEFAULT 0,
  overage_videos INTEGER DEFAULT 0,
  overage_revenue_cents INTEGER DEFAULT 0,
  subscription_revenue_cents INTEGER DEFAULT 0,
  estimated_cost_cents INTEGER DEFAULT 0,
  UNIQUE(user_id, year_month)
);
