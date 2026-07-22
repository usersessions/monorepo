"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Zap, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, PlanId } from "@/lib/tiers";

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [hoveredPlan, setHoveredPlan] = useState<PlanId | null>(null);
  const [isProcessing, setIsProcessing] = useState<PlanId | null>(null);

  const handleCheckout = async (planId: PlanId) => {
    if (planId === "free") {
      window.location.href = "/videos";
      return;
    }
    if (planId === "agency") {
      window.location.href = "/support";
      return;
    }
    
    setIsProcessing(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle: isAnnual ? "annual" : "monthly" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert("Checkout successful (or redirected to Paystack in prod).");
      window.location.href = "/settings";
    } catch (err: any) {
      alert("Checkout failed: " + err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  const plans = Object.values(PLANS);

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="pt-32 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl">
            Ad creation at scale
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Every plan is designed to generate positive ROI on your ad spend. No hidden fees.
            Pay for the videos you generate, upgrade when you scale.
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className={`text-sm ${!isAnnual ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            Monthly
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isAnnual}
            onClick={() => setIsAnnual(!isAnnual)}
            style={{
              width: 44,
              height: 24,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
              background: isAnnual ? 'var(--primary, #6366f1)' : 'var(--border, #374151)',
            }}
          >
            <span style={{
              position: 'absolute',
              top: 3,
              left: isAnnual ? 23 : 3,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
          <span className={`text-sm ${isAnnual ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            Annual
          </span>
          {isAnnual && (
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
              Save 20%
            </span>
          )}
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onMouseEnter={() => setHoveredPlan(plan.id as PlanId)}
                onMouseLeave={() => setHoveredPlan(null)}
                className={`relative rounded-2xl border p-6 transition-all duration-300 ${
                  plan.popular
                    ? "border-primary bg-primary/5 scale-105 shadow-xl"
                    : hoveredPlan === plan.id
                    ? "border-primary/50 shadow-lg"
                    : "border-border bg-card"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      <Sparkles className="h-3 w-3" />
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    {plan.id === "free" && <Zap className="h-5 w-5 text-muted-foreground" />}
                    {plan.id === "starter" && <Sparkles className="h-5 w-5 text-primary" />}
                    {plan.id === "pro" && <Zap className="h-5 w-5 text-primary" />}
                    {plan.id === "agency" && <Building2 className="h-5 w-5 text-primary" />}
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                </div>

                {/* Price */}
                <div className="mb-6 h-20">
                  {plan.id === "agency" ? (
                    <div className="flex items-baseline gap-1 h-full items-center">
                      <span className="text-4xl font-bold">Custom</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">
                          ${isAnnual 
                            ? (plan.price.annual / 12 / 100).toFixed(0) 
                            : (plan.price.monthly / 100).toFixed(0)
                          }
                        </span>
                        <span className="text-muted-foreground">/mo</span>
                      </div>
                      {isAnnual && plan.price.annual > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          ${(plan.price.annual / 100).toFixed(0)} billed annually
                        </p>
                      )}
                      {plan.price.monthly > 0 && isAnnual && (
                        <p className="text-xs text-green-500 mt-1">
                          Save ${((plan.price.monthly * 12 - plan.price.annual) / 100).toFixed(0)}/year
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Video Count — THE KEY METRIC */}
                <div className="mb-6 p-3 rounded-xl bg-background border">
                  <div className="text-2xl font-bold text-primary">
                    {plan.limits.videosPerMonth}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    videos per month
                  </div>
                  {plan.limits.videosPerMonth > 0 && plan.id !== "agency" && (
                    <div className="text-xs text-muted-foreground mt-1">
                      ~${(plan.price.monthly / 100 / plan.limits.videosPerMonth).toFixed(2)} per video
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <Check className={`h-4 w-4 mt-0.5 shrink-0 ${
                        plan.id === "free" ? "text-muted-foreground" : "text-primary"
                      }`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button 
                  onClick={() => handleCheckout(plan.id as PlanId)}
                  disabled={isProcessing === plan.id}
                  className={`w-full h-12 rounded-xl ${
                    plan.popular 
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                      : plan.id === "free"
                      ? "bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                      : "bg-background border-2 border-border hover:border-primary text-foreground"
                  }`}
                  variant={plan.id === "free" ? "secondary" : plan.popular ? "default" : "outline"}
                >
                  {isProcessing === plan.id ? "Processing..." : plan.cta}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="border-t border-border/50 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-2xl font-semibold mb-4">Why this pricing works</h2>
          <div className="grid md:grid-cols-3 gap-8 mt-8">
            {[
              {
                title: "No surprise bills",
                desc: "Hard monthly caps. You'll never pay more than your plan unless you explicitly choose overage."
              },
              {
                title: "Profitable for us",
                desc: "Every plan has a 53-72% margin. We stay in business so you can rely on us long-term."
              },
              {
                title: "Fair overage",
                desc: "Need more? $2/video overage. Expensive enough to push upgrades, cheap enough for emergencies."
              }
            ].map((item, i) => (
              <div key={i} className="text-left">
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
