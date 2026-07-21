"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Video, AlertCircle } from "lucide-react";

interface CreditCounterProps {
  userId?: string;
}

interface UsageStats {
  plan: string;
  videosUsed: number;
  videosLimit: number;
  videosRemaining: number;
  overageVideos: number;
  overageCost: number;
  percentUsed: number;
}

export function CreditCounter({ userId }: CreditCounterProps) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/user/usage`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return null;
  if (!stats) return null;

  const isLow = stats.videosRemaining <= 2 && stats.videosRemaining > 0;
  const isEmpty = stats.videosRemaining === 0;

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${
      isEmpty 
        ? "border-red-500/30 bg-red-500/10" 
        : isLow 
        ? "border-amber-500/30 bg-amber-500/10"
        : "border-border bg-card"
    }`}>
      <Video className={`h-4 w-4 ${
        isEmpty ? "text-red-500" : isLow ? "text-amber-500" : "text-primary"
      }`} />

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {stats.videosRemaining}
        </span>
        <span className="text-xs text-muted-foreground">
          / {stats.videosLimit} videos left
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            isEmpty ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-primary"
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${stats.percentUsed}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {isLow && (
        <AlertCircle className={`h-4 w-4 ${isEmpty ? "text-red-500" : "text-amber-500"}`} />
      )}

      {stats.overageVideos > 0 && (
        <span className="text-xs text-red-500">
          +{stats.overageVideos} overage (${(stats.overageCost / 100).toFixed(2)})
        </span>
      )}
    </div>
  );
}
