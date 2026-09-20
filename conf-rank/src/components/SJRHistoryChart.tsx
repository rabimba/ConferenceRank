"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SJRHistoryPoint } from "@/lib/journal-types";

export interface SJRHistoryChartProps {
  history?: SJRHistoryPoint[];
  data?: SJRHistoryPoint[];
}

type ViewMode = "both" | "sjr" | "h_index";

const axis = {
  tick: { fontSize: 11, fill: "var(--chart-tick)" },
  stroke: "var(--chart-axis)",
};

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid var(--chart-tooltip-border)",
  background: "var(--chart-tooltip-bg)",
  color: "var(--foreground)",
  fontSize: 12,
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
};

export function SJRHistoryChart({ history, data }: SJRHistoryChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("both");

  const chartData = useMemo(() => {
    const raw = history ?? data ?? [];
    return [...raw]
      .filter((p) => p.sjr != null || p.h_index != null)
      .sort((a, b) => a.year - b.year)
      .map((p) => ({
        year: p.year,
        sjr: p.sjr != null ? Number(p.sjr.toFixed(3)) : null,
        h_index: p.h_index != null ? Math.round(p.h_index) : null,
        quartile: p.quartile ?? null,
      }));
  }, [history, data]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-lg border border-dashed border-border bg-stone-50/50 text-xs text-muted dark:bg-stone-900/30">
        No historical SJR or H-Index progression data available.
      </div>
    );
  }

  const hasSjr = chartData.some((d) => d.sjr != null);
  const hasHIndex = chartData.some((d) => d.h_index != null);

  const effectiveMode: ViewMode =
    viewMode === "both" && (!hasSjr || !hasHIndex)
      ? hasSjr
        ? "sjr"
        : "h_index"
      : viewMode;

  return (
    <div className="space-y-3">
      {hasSjr && hasHIndex && (
        <div className="flex items-center justify-end gap-1.5 text-xs">
          <span className="text-muted mr-1 font-medium">Metric:</span>
          <button
            type="button"
            onClick={() => setViewMode("both")}
            className={`rounded px-2.5 py-1 font-medium transition cursor-pointer ${
              effectiveMode === "both"
                ? "bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900"
                : "bg-surface border border-border text-muted hover:text-foreground"
            }`}
          >
            Dual View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("sjr")}
            className={`rounded px-2.5 py-1 font-medium transition cursor-pointer ${
              effectiveMode === "sjr"
                ? "bg-accent text-accent-contrast"
                : "bg-surface border border-border text-muted hover:text-foreground"
            }`}
          >
            SJR Score
          </button>
          <button
            type="button"
            onClick={() => setViewMode("h_index")}
            className={`rounded px-2.5 py-1 font-medium transition cursor-pointer ${
              effectiveMode === "h_index"
                ? "bg-indigo-600 text-white dark:bg-indigo-500"
                : "bg-surface border border-border text-muted hover:text-foreground"
            }`}
          >
            H-Index
          </button>
        </div>
      )}

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: effectiveMode === "both" ? 18 : 12, bottom: 0, left: -10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="year" {...axis} />

            {(effectiveMode === "both" || effectiveMode === "sjr") && (
              <YAxis
                yAxisId="left"
                {...axis}
                orientation="left"
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => v.toFixed(2)}
              />
            )}

            {effectiveMode === "h_index" && (
              <YAxis
                yAxisId="left"
                {...axis}
                orientation="left"
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => Math.round(v).toString()}
              />
            )}

            {effectiveMode === "both" && (
              <YAxis
                yAxisId="right"
                {...axis}
                orientation="right"
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => Math.round(v).toString()}
              />
            )}

            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => {
                const num = Number(value);
                if (name === "SJR Score") {
                  return [num.toFixed(3), "SJR Score"];
                }
                if (name === "H-Index") {
                  return [Math.round(num), "H-Index"];
                }
                return [value, name];
              }}
              labelFormatter={(label) => `Year: ${label}`}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--foreground)" }} />

            {(effectiveMode === "both" || effectiveMode === "sjr") && hasSjr && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="sjr"
                name="SJR Score"
                stroke="var(--accent)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--accent)" }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            )}

            {(effectiveMode === "both" || effectiveMode === "h_index") && hasHIndex && (
              <Line
                yAxisId={effectiveMode === "both" ? "right" : "left"}
                type="monotone"
                dataKey="h_index"
                name="H-Index"
                stroke="#6366F1"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#6366F1" }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default SJRHistoryChart;
