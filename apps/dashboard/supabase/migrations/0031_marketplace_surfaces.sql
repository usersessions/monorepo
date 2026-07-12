-- Feature 4: Marketplace Distribution. Reuses the surfaces pattern — marketplaces are just a
-- new surface category with assisted_manual submission (extension opens the tab + pre-fills;
-- founder submits). Monitoring (link-check) already covers surface rows with a listing URL.

-- Widen the category CHECK constraint to include 'marketplace'.
alter table surfaces drop constraint if exists surfaces_category_check;
alter table surfaces add constraint surfaces_category_check
  check (category in ('github','blog','twitter','podcast','youtube','stackoverflow','community','marketplace'));

insert into surfaces (name, category, url_pattern, submission_type, quality_score, tier_unlock) values
  ('Chrome Web Store', 'marketplace', 'https://chrome.google.com/webstore/devconsole', 'assisted_manual', 84, 1),
  ('Slack Marketplace', 'marketplace', 'https://api.slack.com/apps', 'assisted_manual', 80, 2),
  ('Shopify App Store', 'marketplace', 'https://partners.shopify.com', 'assisted_manual', 82, 2),
  ('GitHub Marketplace', 'marketplace', 'https://github.com/marketplace/new', 'assisted_manual', 81, 1),
  ('Zapier Directory', 'marketplace', 'https://developer.zapier.com/', 'assisted_manual', 79, 2),
  ('Notion Gallery', 'marketplace', 'https://www.notion.so/templates', 'assisted_manual', 72, 1),
  ('Figma Community', 'marketplace', 'https://www.figma.com/community', 'assisted_manual', 74, 1)
on conflict do nothing;
