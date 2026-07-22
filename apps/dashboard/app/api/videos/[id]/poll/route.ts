import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryTaskStatus, getVideoUrl } from "@/services/minimax-client";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params if using Next.js 15
    const { id } = await Promise.resolve(params);

    const { data: video, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Only the owner can view their video status
    if (video.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Safety net: If status is 'submitted_to_minimax' but webhook hasn't arrived,
    // we manually poll MiniMax API.
    if (video.status === 'generating' && video.fal_request_id) {
      try {
        const result = await queryTaskStatus(video.fal_request_id);
        if (result.status === "Success" && result.file_id) {
          const videoUrl = await getVideoUrl(result.file_id);
          // Update database
          await supabase.from("videos").update({
            status: "ready",
            video_url: videoUrl
          }).eq("id", video.id);
          
          video.status = "ready";
          video.video_url = videoUrl;
        } else if (result.status === "Fail") {
          throw new Error(`MiniMax task failed: ${result.err_msg || "Unknown error"}`);
        }
      } catch (err: any) {
        await supabase.from("videos").update({
          status: "failed",
          error: err.message
        }).eq("id", video.id);
        
        video.status = "failed";
        video.error = err.message;
      }
    }

    return NextResponse.json({
      id: video.id,
      status: video.status,
      url: video.url,
      concepts: video.concepts,
      active_variant_index: video.active_variant_index,
      video_url: video.video_url,
      error: video.error,
      created_at: video.created_at,
    });
  } catch (err: any) {
    console.error("Poll error:", err);
    return NextResponse.json({ error: "Failed to fetch job status" }, { status: 500 });
  }
}
