import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { creditManager } from "@/services/credits";
import { scrapeProduct, ScrapeError } from "@/services/scraper-new";
import { generateVideoConcepts, VideoConcept } from "@/services/prompt-engine";
import { submitVideo, MiniMaxSubmitError } from "@/services/minimax-new";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Check credits BEFORE anything else
    const creditCheck = await creditManager.checkGenerationAllowed({
      userId: user.id,
      resolution: "1080p", // MiniMax standard tier maps to 1080p for credit check
      wantsCustomPrompt: false,
      wantsBulk: false,
      bulkCount: 1,
    });

    if (!creditCheck.allowed && !creditCheck.overageCost) {
      return NextResponse.json(
        { 
          error: creditCheck.reason,
          code: "PLAN_LIMIT",
          upgradeUrl: "/pricing",
        },
        { status: 403 }
      );
    }

    // If overage, we still allow but charge extra
    const isOverage = !!creditCheck.overageCost;

    // Deduct credit immediately (fail-closed: if payment fails, we don't generate)
    await creditManager.deductCredit(user.id, isOverage);

    // Create video record in 'pending' state
    const { data: video, error } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        status: "scraping",
        url: url,
      })
      .select()
      .single();

    if (error) throw error;

    // Next.js (if not using waitUntil) requires us to await the process to finish
    // However, we only need to await up to Fal.ai submission, not the final render.

    let product;
    try {
      product = await scrapeProduct(url);
      await supabase.from("videos").update({ status: "generating_prompt", product_data: product as any }).eq('id', video.id);
    } catch (err: any) {
      console.warn(`Scrape failed: ${err.message}`);
      await supabase.from("videos").update({
        status: "scrape_failed",
        error: "Couldn't auto-import this product. Enter the title, description, and an image manually to continue."
      }).eq('id', video.id);
      return NextResponse.json({ error: "Scrape failed", videoId: video.id }, { status: 400 });
    }

    let concepts: VideoConcept[];
    try {
      const apiKey = process.env.GEMINI_API_KEY || '';
      concepts = await generateVideoConcepts(product, apiKey, 3);
      await supabase.from("videos").update({ concepts: concepts as any }).eq('id', video.id);
    } catch (err: any) {
      console.error(`Prompt generation failed: ${err.message}`);
      await supabase.from("videos").update({ status: "prompt_failed", error: err.message }).eq('id', video.id);
      return NextResponse.json({ error: "Prompt generation failed", videoId: video.id }, { status: 500 });
    }

    // Submit the first variant (variant 0) to MiniMax
    const activeVariant = concepts[0];
    const baseUrl = process.env.PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const webhookUrl = `${baseUrl}/api/webhooks/fal/${video.id}`;

    try {
      const result = await submitVideo(
        activeVariant.hailuo_prompt,
        webhookUrl,
        String(activeVariant.duration_seconds),
        false // standard tier
      );

      await supabase.from("videos").update({
        status: "submitted_to_minimax",
        active_variant_index: 0,
        fal_request_id: result.request_id,
        fal_model: result.model
      }).eq('id', video.id);

      return NextResponse.json({
        success: true,
        videoId: video.id,
        status: "submitted_to_minimax",
        isOverage,
        overageCost: creditCheck.overageCost,
        remainingVideos: creditCheck.remainingVideos - 1,
      });
    } catch (err: any) {
      console.error(`Fal submission failed: ${err.message}`);
      await supabase.from("videos").update({ status: "failed", error: err.message }).eq('id', video.id);
      return NextResponse.json({ error: "Video submission failed", videoId: video.id }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Video generation error:", error);
    return NextResponse.json(
      { error: error.message || "Generation failed" },
      { status: 500 }
    );
  }
}
