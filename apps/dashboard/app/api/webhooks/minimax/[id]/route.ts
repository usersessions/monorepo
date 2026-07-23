import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js"; // use service role for webhook
import { getVideoUrl } from "@/services/minimax-client";

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await Promise.resolve(params);
    const body = await req.json();

    // Challenge-response for MiniMax webhook validation
    if (body.challenge) {
      return NextResponse.json({ challenge: body.challenge }, { status: 200 });
    }

    // Supabase service role client to bypass RLS since this is a server-to-server webhook
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: video, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !video) {
      // Return 200 to acknowledge receipt even if video isn't found, 
      // to prevent endless retries.
      console.warn(`Webhook received for unknown video id: ${id}`);
      return NextResponse.json({ ok: false, reason: "unknown job" }, { status: 200 });
    }

    // Check request ID match
    if (video.fal_request_id && body.task_id && body.task_id !== video.fal_request_id) {
      console.warn(`Webhook task_id mismatch for video ${id}`);
      return NextResponse.json({ ok: false, reason: "task_id mismatch" }, { status: 200 });
    }

    if (body.status === "failed") {
      await supabase.from("videos").update({
        status: "failed",
        error: body.base_resp?.status_msg || "MiniMax render failed"
      }).eq("id", id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (body.status === "success" && body.file_id) {
      try {
        const videoUrl = await getVideoUrl(body.file_id);
        // 'ready' is the unified terminal status (the poll route also writes 'ready').
        await supabase.from("videos").update({
          status: "ready",
          video_url: videoUrl
        }).eq("id", id);
      } catch (err: any) {
        await supabase.from("videos").update({
          status: "failed",
          error: err.message
        }).eq("id", id);
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
