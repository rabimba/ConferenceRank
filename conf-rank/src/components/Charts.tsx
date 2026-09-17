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
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

const COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d",
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
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
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
          stroke="#2563eb"
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
        <Bar dataKey="accepted" name="Accepted" fill="#16a34a" radius={[3, 3, 0, 0]} />
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
          stroke="#d97706"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#d97706" }}
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

export interface LandscapePoint {
  id: string;
  acronym: string;
  rank: string;
  rate: number;
  accepted?: number;
}

const RANK_NUM: Record<string, number> = {
  "A*": 4,
  A: 3,
  B: 2,
  C: 1,
};

export function RankRateScatterChart({
  data,
  onSelectVenue,
}: {
  data: LandscapePoint[];
  onSelectVenue?: (id: string) => void;
}) {
  const points = data
    .filter((d) => RANK_NUM[d.rank] != null)
    .map((d) => ({
      ...d,
      rankNum: RANK_NUM[d.rank],
      size: Math.max(40, Math.min(250, (d.accepted ?? 100) / 10)),
    }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 12, right: 20, bottom: 10, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis
          type="number"
          dataKey="rankNum"
          name="Rank"
          ticks={[1, 2, 3, 4]}
          domain={[0.5, 4.5]}
          tickFormatter={(v: number) => ({ 1: "C", 2: "B", 3: "A", 4: "A*" })[v] ?? ""}
          {...axis}
        />
        <YAxis
          type="number"
          dataKey="rate"
          name="Acceptance Rate"
          unit="%"
          domain={[5, 55]}
          {...axis}
        />
        <ZAxis type="number" dataKey="size" range={[60, 350]} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ strokeDasharray: "3 3" }}
          content={({ payload }) => {
            if (!payload || !payload.length) return null;
            const item = payload[0].payload as LandscapePoint;
            return (
              <div
                style={tooltipStyle}
                className="p-2.5 shadow-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
              >
                <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <span>{item.acronym}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-neutral-100 dark:bg-neutral-800">
                    {item.rank}
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                  Acceptance Rate: <span className="font-semibold text-blue-600 dark:text-blue-400">{item.rate}%</span>
                </div>
                {item.accepted != null && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    Papers: {item.accepted.toLocaleString()}
                  </div>
                )}
                {onSelectVenue && (
                  <div className="mt-1.5 text-[10px] text-blue-500 font-medium">Click point to view</div>
                )}
              </div>
            );
          }}
        />
        <Scatter
          name="Venues"
          data={points}
          fill="#2563eb"
          onClick={(p: unknown) => {
            const pt = p as { payload?: LandscapePoint };
            if (pt?.payload?.id && onSelectVenue) {
              onSelectVenue(pt.payload.id);
            }
          }}
        >
          {points.map((entry) => {
            const color =
              entry.rank === "A*"
                ? "#d97706"
                : entry.rank === "A"
                  ? "#2563eb"
                  : entry.rank === "B"
                    ? "#0d9488"
                    : "#64748b";
            return <Cell key={entry.id} fill={color} className="cursor-pointer hover:opacity-80" />;
          })}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
