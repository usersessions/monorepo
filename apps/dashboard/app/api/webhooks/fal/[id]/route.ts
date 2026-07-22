import { NextRequest, NextResponse } from "next/server";
import { verifyFalWebhook, extractVideoUrl, MiniMaxSubmitError } from "@/services/minimax-new";
import { createClient } from "@supabase/supabase-js"; // use service role for webhook

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await Promise.resolve(params);

  // Read raw body as buffer for signature verification
  const arrayBuffer = await req.arrayBuffer();
  const rawBody = Buffer.from(arrayBuffer);

  const requestId = req.headers.get("x-fal-webhook-request-id") || "";
  const userId = req.headers.get("x-fal-webhook-user-id") || "";
  const timestamp = req.headers.get("x-fal-webhook-timestamp") || "";
  const signatureHex = req.headers.get("x-fal-webhook-signature") || "";

  const isValid = await verifyFalWebhook(
    requestId,
    userId,
    timestamp,
    signatureHex,
    rawBody
  );

  if (!isValid) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
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
    // to prevent Fal from endlessly retrying.
    console.warn(`Webhook received for unknown video id: ${id}`);
    return NextResponse.json({ ok: false, reason: "unknown job" }, { status: 200 });
  }

  // Check request ID match
  if (video.fal_request_id && requestId !== video.fal_request_id) {
    console.warn(`Webhook request_id mismatch for video ${id}`);
    return NextResponse.json({ ok: false, reason: "request_id mismatch" }, { status: 200 });
  }

  const payloadString = rawBody.toString('utf-8');
  let payload: any;
  try {
    payload = JSON.parse(payloadString);
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.status !== "OK") {
    await supabase.from("videos").update({
      status: "failed",
      error: payload.error || "render failed"
    }).eq("id", id);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    const videoUrl = extractVideoUrl(payload.payload);
    await supabase.from("videos").update({
      status: "completed",
      video_url: videoUrl
    }).eq("id", id);
  } catch (err: any) {
    await supabase.from("videos").update({
      status: "failed",
      error: err.message
    }).eq("id", id);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
