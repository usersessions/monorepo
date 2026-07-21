import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS, PlanId, getPlanPrice } from "@/lib/tiers";
import { creditManager } from "@/services/credits";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { planId, billingCycle = "monthly" }: { planId: PlanId; billingCycle: "monthly" | "annual" } = body;

    // Validate plan
    if (!PLANS[planId]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const plan = PLANS[planId];
    const amount = getPlanPrice(planId, billingCycle);

    // Get or create Paystack customer
    const profile = await supabase
      .from("profiles")
      .select("paystack_customer_code, email")
      .eq("id", user.id)
      .single();

    let customerCode = profile.data?.paystack_customer_code;

    if (!customerCode) {
      // Create Paystack customer
      const customerRes = await fetch("https://api.paystack.co/customer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email || profile.data?.email,
          first_name: user.user_metadata?.full_name?.split(" ")[0] || "",
          last_name: user.user_metadata?.full_name?.split(" ").slice(1).join(" ") || "",
        }),
      });

      const customerData = await customerRes.json();
      if (!customerData.status) {
        throw new Error(customerData.message);
      }

      customerCode = customerData.data.customer_code;

      // Save customer code
      await supabase
        .from("profiles")
        .update({ paystack_customer_code: customerCode })
        .eq("id", user.id);
    }

    // Create subscription on Paystack
    // Note: Paystack uses plan codes. You create plans in Paystack dashboard.
    const planCode = process.env[`PAYSTACK_PLAN_${planId.toUpperCase()}_${billingCycle.toUpperCase()}`];

    if (!planCode) {
      return NextResponse.json({ error: "Plan not configured" }, { status: 500 });
    }

    // Since we want to redirect the user to a checkout flow for Paystack, we should initialize a transaction 
    // instead of creating a subscription directly if we don't have authorization yet. 
    // But per the spec, this creates a subscription if the customer has a card, or initiates auth?
    // Wait, the spec provided is:
    /*
    const subRes = await fetch("https://api.paystack.co/subscription", {
      method: "POST",
      ...
    });
    */
    // Paystack /subscription creates a subscription using the customer's active authorization.
    // If they don't have one, this fails. I'll stick to the spec code exactly for the implementation.
    
    const subRes = await fetch("https://api.paystack.co/subscription", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: customerCode,
        plan: planCode,
        start_date: new Date().toISOString(),
      }),
    });

    const subData = await subRes.json();
    if (!subData.status) {
      // If the customer has no saved card, Paystack subscription creation fails.
      // In a real implementation we would initialize a transaction here, but I am following the provided spec.
      // For completeness, I'll return the error as given.
      throw new Error(subData.message);
    }

    // Save subscription details
    await supabase
      .from("profiles")
      .update({
        plan: planId,
        billing_cycle: billingCycle,
        paystack_subscription_code: subData.data.subscription_code,
        paystack_email_token: subData.data.email_token,
        plan_started_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // Update credits
    await creditManager.handlePlanChange(user.id, planId);

    return NextResponse.json({
      success: true,
      subscriptionCode: subData.data.subscription_code,
      status: subData.data.status,
    });

  } catch (error: any) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Checkout failed" },
      { status: 500 }
    );
  }
}
