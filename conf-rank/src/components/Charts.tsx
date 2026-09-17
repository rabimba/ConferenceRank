"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = [
  "#8C2F39", "#B45309", "#3F6212", "#8A6D1D", "#6B3FA0",
  "#0F766E", "#B3364A", "#57534E",
];

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
};

export function AcceptanceTrendChart({
  data,
}: {
  data: { year: number; rate: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
        <defs>
          <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="year" {...axis} />
        <YAxis {...axis} unit="%" domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [`${v}%`, "Acceptance rate"]}
        />
        <Area
          type="monotone"
          dataKey="rate"
          stroke="var(--accent)"
          strokeWidth={2}
          fill="url(#rateFill)"
          dot={{ r: 2.5 }}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PapersPerYearChart({
  data,
}: {
  data: { year: number; accepted?: number; submitted?: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="year" {...axis} />
        <YAxis {...axis} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--foreground)" }} />
        {data.some((d) => d.submitted != null) && (
          <Bar dataKey="submitted" name="Submitted" fill="var(--chart-submitted)" radius={[3, 3, 0, 0]} />
        )}
        <Bar dataKey="accepted" name="Accepted" fill="var(--success)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const RANK_Y: Record<string, number> = {
  "A*": 6,
  A: 5,
  B: 4,
  "Australasian B": 3,
  C: 2,
  "Australasian C": 1,
};

export function RankHistoryChart({
  data,
}: {
  data: { year: number; rank: string }[];
}) {
  const points = data
    .filter((d) => RANK_Y[d.rank] != null)
    .map((d) => ({ ...d, y: RANK_Y[d.rank] }));
  if (points.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="year" {...axis} />
        <YAxis
          {...axis}
          domain={[0.5, 6.5]}
          ticks={[1, 2, 3, 4, 5, 6]}
          tickFormatter={(v: number) =>
            ({ 1: "Aus C", 2: "C", 3: "Aus B", 4: "B", 5: "A", 6: "A*" })[v] ?? ""
          }
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(_v, _n, p) => [p?.payload?.rank ?? String(_v), "Rank"]}
        />
        <Line
          type="stepAfter"
          dataKey="y"
          stroke="var(--warn)"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "var(--warn)" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TopicTrendChart({
  data,
}: {
  data: { year: string; [topic: string]: string | number }[];
}) {
  const topics = Object.keys(data[0] ?? {}).filter((k) => k !== "year");
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="year" {...axis} />
        <YAxis {...axis} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, n) => [`${(Number(v) * 100).toFixed(1)}%`, String(n)]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--foreground)" }} />
        {topics.map((t, i) => (
          <Line
            key={t}
            dataKey={t}
            type="monotone"
            strokeWidth={2}
            dot={false}
            stroke={COLORS[i % COLORS.length]}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TopicShareChart({
  data,
}: {
  data: { name: string; share: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
        <XAxis type="number" {...axis} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
        <YAxis
          type="category"
          dataKey="name"
          {...axis}
          width={180}
          tickFormatter={(v: string) => (v.length > 28 ? v.slice(0, 26) + "…" : v)}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, "Share of papers"]}
        />
        <Bar dataKey="share" radius={[0, 3, 3, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
