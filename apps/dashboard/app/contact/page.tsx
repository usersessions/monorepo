"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Mail, Phone, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingFooter } from "@/components/MarketingFooter";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    teamSize: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      // Send via the existing /api/admin/settings/email-test endpoint pattern
      // or directly via a mailto fallback — swap for a proper endpoint when ready.
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send message");
      }

      setStatus("sent");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please email us directly.");
      setStatus("error");
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="pt-32 pb-16">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-6">
              <Building2 className="h-4 w-4" />
              Agency Plan
            </div>
            <h1 className="text-4xl font-bold sm:text-5xl mb-4">
              Let&apos;s talk about your agency
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Agency pricing is custom — built around your team size, volume, and workflow.
              Fill in the form and we&apos;ll get back to you within one business day.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* What you get */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-semibold">What&apos;s included</h2>
              <ul className="space-y-4">
                {[
                  "Custom video generation quota (negotiated per client)",
                  "1080p export quality, no watermark",
                  "White-label exports",
                  "API access for custom integrations",
                  "Up to 10 team seats (expandable)",
                  "Priority generation queue",
                  "Bulk generation — 20 videos at once",
                  "Dedicated account manager",
                  "Custom AI prompts & brand voice",
                  "Onboarding & workflow setup call",
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-6 space-y-4 mt-8">
                <p className="text-sm font-medium">Prefer email or a call?</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 text-primary" />
                  <a href="mailto:info@usersessions.io" className="hover:text-foreground transition-colors">
                    info@usersessions.io
                  </a>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 text-primary" />
                  <span>We&apos;ll share our number once we connect</span>
                </div>
              </div>
            </motion.div>

            {/* Contact form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl border border-border/60 bg-card p-8"
            >
              {status === "sent" ? (
                <div className="flex flex-col items-center justify-center text-center h-full py-12 gap-4">
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                  <h3 className="text-xl font-semibold">Message sent!</h3>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    Thanks for reaching out. We&apos;ll get back to you within one business day.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h3 className="text-lg font-semibold mb-6">Get in touch</h3>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="name" className="text-sm font-medium">
                        Full name <span className="text-destructive">*</span>
                      </label>
                      <input
                        id="name"
                        name="name"
                        required
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Jane Smith"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="email" className="text-sm font-medium">
                        Work email <span className="text-destructive">*</span>
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="jane@agency.com"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="company" className="text-sm font-medium">
                      Company / Agency name <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="company"
                      name="company"
                      required
                      value={form.company}
                      onChange={handleChange}
                      placeholder="Acme Agency"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="teamSize" className="text-sm font-medium">
                      Team size
                    </label>
                    <select
                      id="teamSize"
                      name="teamSize"
                      value={form.teamSize}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">Select team size</option>
                      <option value="1-5">1–5 people</option>
                      <option value="6-15">6–15 people</option>
                      <option value="16-50">16–50 people</option>
                      <option value="50+">50+ people</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="message" className="text-sm font-medium">
                      Tell us about your use case <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={4}
                      value={form.message}
                      onChange={handleChange}
                      placeholder="What are you trying to achieve? How many videos do you need per month? Any specific integrations?"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    />
                  </div>

                  {status === "error" && error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={status === "sending"}
                    className="w-full h-12 rounded-xl gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {status === "sending" ? "Sending…" : "Send message"}
                  </Button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
