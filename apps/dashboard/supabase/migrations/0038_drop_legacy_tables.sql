-- 0038_drop_legacy_tables.sql
-- Drops all tables related to the old directory submission product.

DROP TABLE IF EXISTS "public"."adapter_verifications" CASCADE;
DROP TABLE IF EXISTS "public"."adapter_runs" CASCADE;
DROP TABLE IF EXISTS "public"."competitor_scans" CASCADE;
DROP TABLE IF EXISTS "public"."visibility_competitors" CASCADE;
DROP TABLE IF EXISTS "public"."visibility_checks" CASCADE;
DROP TABLE IF EXISTS "public"."visibility_queries" CASCADE;
DROP TABLE IF EXISTS "public"."landing_page_audits" CASCADE;
DROP TABLE IF EXISTS "public"."founder_audits" CASCADE;
DROP TABLE IF EXISTS "public"."review_requests" CASCADE;
DROP TABLE IF EXISTS "public"."review_campaigns" CASCADE;
DROP TABLE IF EXISTS "public"."review_platforms" CASCADE;
DROP TABLE IF EXISTS "public"."generated_content" CASCADE;
DROP TABLE IF EXISTS "public"."community_responses" CASCADE;
DROP TABLE IF EXISTS "public"."community_opportunities" CASCADE;
DROP TABLE IF EXISTS "public"."referral_programs" CASCADE;
DROP TABLE IF EXISTS "public"."platform_request_votes" CASCADE;
DROP TABLE IF EXISTS "public"."platform_requests" CASCADE;
DROP TABLE IF EXISTS "public"."agent_computer_use_sessions" CASCADE;
DROP TABLE IF EXISTS "public"."surface_status" CASCADE;
DROP TABLE IF EXISTS "public"."intelligence_briefings" CASCADE;
