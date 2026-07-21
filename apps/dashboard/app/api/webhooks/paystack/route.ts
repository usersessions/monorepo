import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { creditManager } from "@/services/credits";
import crypto from "crypto";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    // Verify signature
    const signature = req.headers.get("x-paystack-signature");
    const body = await req.text();

    const hash = crypto
      .createHmac("sha512", WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    if (hash !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);
    const supabase = await createClient();

    switch (event.event) {
      case "charge.success": {
        // Payment received
        const { customer, plan } = event.data;

        // Find user by Paystack customer code
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, plan")
          .eq("paystack_customer_code", customer.customer_code)
          .single();

        if (profile) {
          // Update plan if provided
          if (plan) {
            const planId = plan.plan_code.split("_")[0]; // Extract plan from code
            await creditManager.handlePlanChange(profile.id, planId as any);
          }

          // Send payment receipt email
          await sendPaymentReceipt(profile.id, event.data);
        }
        break;
      }

      case "subscription.create": {
        // Subscription created
        const { customer, subscription_code, email_token } = event.data;

        await supabase
          .from("profiles")
          .update({
            paystack_subscription_code: subscription_code,
            paystack_email_token: email_token,
          })
          .eq("paystack_customer_code", customer.customer_code);
        break;
      }

      case "subscription.disable": {
        // Subscription cancelled or expired
        const { subscription_code } = event.data;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("paystack_subscription_code", subscription_code)
          .single();

        if (profile) {
          // Downgrade to free
          await supabase
            .from("profiles")
            .update({
              plan: "free",
              videos_limit_this_month: 2,
              paystack_subscription_code: null,
              paystack_email_token: null,
            })
            .eq("id", profile.id);

          await creditManager.handlePlanChange(profile.id, "free");
        }
        break;
      }

      case "invoice.payment_failed": {
        // Payment failed — dunning
        const { customer } = event.data;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("paystack_customer_code", customer.customer_code)
          .single();

        if (profile) {
          // Send dunning email
          await sendDunningEmail(profile.id, event.data);

          // After 3 failed attempts, downgrade
          // (Paystack handles retries, we just track)
        }
        break;
      }

      default:
        console.log("Unhandled Paystack event:", event.event);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error("Paystack webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function sendPaymentReceipt(userId: string, paymentData: any) {
  // Implementation using your existing email system
  console.log(`Sending payment receipt to user ${userId}`, paymentData);
}

async function sendDunningEmail(userId: string, invoiceData: any) {
  // Implementation using your existing email system
  console.log(`Sending dunning email to user ${userId}`, invoiceData);
}
