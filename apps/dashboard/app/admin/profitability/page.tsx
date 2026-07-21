"use client";

import { useEffect, useState } from "react";
import { PLANS, PlanId, analyzePlanProfitability } from "@/lib/tiers";

export default function ProfitabilityPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/profitability")
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Profitability Analysis</h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {(Object.keys(PLANS) as PlanId[]).map(planId => {
          const analysis = analyzePlanProfitability(planId);
          const plan = PLANS[planId];

          return (
            <div key={planId} className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold text-lg">{plan.name}</h3>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Revenue/mo</span>
                  <span className="font-medium">${analysis.revenuePerMonth.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max COGS/mo</span>
                  <span className="font-medium">${analysis.maxCostPerMonth.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Min Profit/mo</span>
                  <span className="font-medium text-green-500">${analysis.minProfitPerMonth.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Margin</span>
                  <span className={`font-medium ${analysis.marginPercent >= 70 ? "text-green-500" : "text-amber-500"}`}>
                    {analysis.marginPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Break-even</span>
                  <span className="font-medium">{analysis.breakEvenVideos} videos</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time metrics */}
      {data && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">This Month's Actuals</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{data.totalVideosGenerated}</div>
              <div className="text-sm text-muted-foreground">Videos Generated</div>
            </div>
            <div>
              <div className="text-2xl font-bold">${data.totalRevenue.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Revenue</div>
            </div>
            <div>
              <div className="text-2xl font-bold">${data.totalCost.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Estimated COGS</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">${data.totalProfit.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Profit</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
