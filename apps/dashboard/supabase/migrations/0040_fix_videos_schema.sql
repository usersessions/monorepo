-- Drop the restrictive check constraint on status
ALTER TABLE public.videos DROP CONSTRAINT videos_status_check;

-- Add missing columns expected by the UI
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS product_url TEXT;

-- Make url nullable because the UI provides productUrl instead of url
ALTER TABLE public.videos ALTER COLUMN url DROP NOT NULL;

-- Update check constraint to include UI statuses
ALTER TABLE public.videos ADD CONSTRAINT videos_status_check 
  CHECK (status IN (
    'pending', 'scraping', 'scrape_failed', 'generating_prompt', 
    'prompt_failed', 'submitted_to_minimax', 'completed', 'failed',
    'queued', 'generating', 'ready'
  ));
