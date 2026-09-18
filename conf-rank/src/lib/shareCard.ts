export interface ShareVenueData {
  type: "venue";
  acronym: string;
  title: string;
  rank: string;
  categories?: string[];
  acceptanceRate?: string | number | null;
  acceptanceYear?: number | null;
  acceptedPapers?: string | number | null;
  submissions?: string | number | null;
  nextDeadline?: string | null;
  communityRating?: number | string | null;
  url?: string;
}

export interface ShareDirectoryData {
  type: "directory";
  title: string;
  subtitle: string;
  count: number;
  ranks?: string[];
  categories?: string[];
  sampleVenues?: string[];
  url?: string;
}

export interface ShareComparisonData {
  type: "comparison";
  title: string;
  venues: Array<{
    acronym: string;
    title: string;
    rank: string;
    rate?: string | number | null;
  }>;
  url?: string;
}

export type ShareCardData = ShareVenueData | ShareDirectoryData | ShareComparisonData;

const RANK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "A*": { bg: "#78350f", text: "#fef3c7", border: "#f59e0b" },
  A: { bg: "#7c2d12", text: "#ffedd5", border: "#ea580c" },
  B: { bg: "#064e3b", text: "#d1fae5", border: "#10b981" },
  C: { bg: "#292524", text: "#f5f5f4", border: "#78716c" },
  "Australasian B": { bg: "#064e3b", text: "#d1fae5", border: "#059669" },
  "Australasian C": { bg: "#292524", text: "#f5f5f4", border: "#78716c" },
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function generateShareCardBlob(data: ShareCardData): Promise<Blob> {
  const width = 1200;
  const height = 630;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas 2D context");
  }

  // Base canvas background: rich dark slate gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#0b0f19");
  bgGrad.addColorStop(0.5, "#0f172a");
  bgGrad.addColorStop(1, "#020617");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle ambient radial glow in upper-right and lower-left
  const glow1 = ctx.createRadialGradient(950, 150, 10, 950, 150, 450);
  glow1.addColorStop(0, "rgba(2, 132, 199, 0.18)");
  glow1.addColorStop(1, "rgba(2, 132, 199, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(200, 500, 10, 200, 500, 400);
  glow2.addColorStop(0, "rgba(99, 102, 241, 0.12)");
  glow2.addColorStop(1, "rgba(99, 102, 241, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Card Outer Border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 2;
  roundRect(ctx, 24, 24, width - 48, height - 48, 20);
  ctx.stroke();

  // Top Navigation Bar / Branding
  // Emblem Icon [CR]
  roundRect(ctx, 64, 60, 44, 44, 10);
  ctx.fillStyle = "#0284c7";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CR", 86, 82);

  // Brand Name
  ctx.textAlign = "left";
  ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText("ConferenceRank", 122, 82);

  // Verified tag pill
  ctx.font = "600 13px system-ui, -apple-system, sans-serif";
  const tagText = "Verified CS Conference Intelligence";
  const tagW = ctx.measureText(tagText).width + 24;
  roundRect(ctx, width - 64 - tagW, 64, tagW, 36, 18);
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.stroke();

  ctx.fillStyle = "#38bdf8";
  ctx.fillText(tagText, width - 64 - tagW + 12, 82);

  // Divider Line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 126);
  ctx.lineTo(width - 64, 126);
  ctx.stroke();

  // Draw content depending on card type
  if (data.type === "venue") {
    drawVenueCard(ctx, data, width);
  } else if (data.type === "directory") {
    drawDirectoryCard(ctx, data, width);
  } else {
    drawComparisonCard(ctx, data, width);
  }

  // Footer URL
  ctx.textAlign = "left";
  ctx.font = "500 15px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("rabimba.github.io/ConferenceRank", 64, 575);

  ctx.textAlign = "right";
  ctx.fillStyle = "#475569";
  ctx.fillText("Data: CORE • PaperCopilot • DBLP • OpenAlex • Deadlines", width - 64, 575);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to export canvas to PNG blob"));
    }, "image/png");
  });
}

function drawVenueCard(
  ctx: CanvasRenderingContext2D,
  v: ShareVenueData,
  width: number
) {
  // Venue Acronym (large)
  ctx.textAlign = "left";
  ctx.font = "900 68px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(v.acronym, 64, 206);

  // Rank Badge next to Acronym
  const acrWidth = ctx.measureText(v.acronym).width;
  const rankColors = RANK_COLORS[v.rank] ?? {
    bg: "#1e293b",
    text: "#cbd5e1",
    border: "#475569",
  };

  const badgeX = 64 + acrWidth + 24;
  const badgeY = 154;
  const badgeH = 54;
  ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
  const rankLabel = `CORE ${v.rank}`;
  const badgeW = ctx.measureText(rankLabel).width + 36;

  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fillStyle = rankColors.bg;
  ctx.fill();
  ctx.strokeStyle = rankColors.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = rankColors.text;
  ctx.fillText(rankLabel, badgeX + 18, badgeY + 36);

  // Full Title
  ctx.font = "500 24px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
  let titleStr = v.title;
  if (ctx.measureText(titleStr).width > width - 128) {
    while (ctx.measureText(titleStr + "…").width > width - 128 && titleStr.length > 10) {
      titleStr = titleStr.slice(0, -1);
    }
    titleStr += "…";
  }
  ctx.fillText(titleStr, 64, 252);

  // Metric Boxes Row (3 boxes)
  const boxY = 286;
  const boxH = 150;
  const gap = 20;
  const boxW = (width - 128 - gap * 2) / 3;

  // Box 1: Acceptance Rate
  drawMetricBox(
    ctx,
    64,
    boxY,
    boxW,
    boxH,
    "ACCEPTANCE RATE",
    v.acceptanceRate != null ? `${v.acceptanceRate}%` : "N/A",
    v.acceptanceYear
      ? `${v.acceptedPapers ?? "—"} accepted (${v.acceptanceYear})`
      : "Historical stats recorded"
  );

  // Box 2: Next Submission Deadline
  drawMetricBox(
    ctx,
    64 + boxW + gap,
    boxY,
    boxW,
    boxH,
    "SUBMISSION DEADLINE",
    v.nextDeadline ? v.nextDeadline.split(" ")[0] : "TBA",
    v.nextDeadline || "AoE Countdown"
  );

  // Box 3: Community & Impact Tier
  drawMetricBox(
    ctx,
    64 + (boxW + gap) * 2,
    boxY,
    boxW,
    boxH,
    "VENUE IMPACT TIER",
    v.rank === "A*"
      ? "Top 7.5% Flagship"
      : v.rank === "A"
        ? "Premier Tier"
        : v.rank === "B"
          ? "Established Tier"
          : "Recognized Tier",
    v.communityRating ? `★ ${v.communityRating} Rating` : "ICORE Evaluated"
  );

  // Category tags
  if (v.categories && v.categories.length > 0) {
    let catX = 64;
    const catY = 464;
    ctx.font = "600 14px system-ui, -apple-system, sans-serif";

    for (const cat of v.categories.slice(0, 4)) {
      const w = ctx.measureText(cat).width + 24;
      if (catX + w > width - 64) break;

      roundRect(ctx, catX, catY, w, 34, 17);
      ctx.fillStyle = "rgba(2, 132, 199, 0.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(cat, catX + 12, catY + 22);
      catX += w + 12;
    }
  }
}

function drawDirectoryCard(
  ctx: CanvasRenderingContext2D,
  d: ShareDirectoryData,
  width: number
) {
  ctx.textAlign = "left";
  ctx.font = "900 48px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(d.title, 64, 200);

  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(d.subtitle, 64, 240);

  // Large Count Callout Box
  const boxY = 274;
  const boxW = width - 128;
  const boxH = 170;

  roundRect(ctx, 64, boxY, boxW, boxH, 16);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = "800 64px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#38bdf8";
  const countStr = `${d.count.toLocaleString()} Venues`;
  ctx.fillText(countStr, 96, boxY + 76);

  ctx.font = "500 18px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(
    "Benchmark acceptance rates, AoE submission countdowns, and CORE tiers",
    96,
    boxY + 124
  );

  // Sample venues pills
  if (d.sampleVenues && d.sampleVenues.length > 0) {
    let px = 64;
    const py = 472;
    ctx.font = "600 15px system-ui, -apple-system, sans-serif";
    for (const v of d.sampleVenues.slice(0, 7)) {
      const pw = ctx.measureText(v).width + 24;
      if (px + pw > width - 64) break;

      roundRect(ctx, px, py, pw, 36, 18);
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.stroke();

      ctx.fillStyle = "#f1f5f9";
      ctx.fillText(v, px + 12, py + 23);
      px += pw + 12;
    }
  }
}

function drawComparisonCard(
  ctx: CanvasRenderingContext2D,
  c: ShareComparisonData,
  width: number
) {
  ctx.textAlign = "left";
  ctx.font = "900 44px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText("Venue Comparison", 64, 190);

  ctx.font = "500 20px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`Side-by-side evaluation of ${c.venues.length} conferences`, 64, 226);

  const count = Math.min(c.venues.length, 4);
  const gap = 16;
  const colW = (width - 128 - gap * (count - 1)) / count;
  const colY = 256;
  const colH = 250;

  for (let i = 0; i < count; i++) {
    const v = c.venues[i];
    const x = 64 + i * (colW + gap);

    roundRect(ctx, x, colY, colW, colH, 16);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.stroke();

    // Venue acronym
    ctx.font = "900 32px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(v.acronym, x + 20, colY + 50);

    // Rank Pill
    const rStyle = RANK_COLORS[v.rank] ?? { bg: "#334155", text: "#f8fafc", border: "#64748b" };
    ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
    const rW = ctx.measureText(v.rank).width + 20;
    roundRect(ctx, x + 20, colY + 70, rW, 28, 8);
    ctx.fillStyle = rStyle.bg;
    ctx.fill();
    ctx.strokeStyle = rStyle.border;
    ctx.stroke();
    ctx.fillStyle = rStyle.text;
    ctx.fillText(v.rank, x + 30, colY + 90);

    // Rate
    ctx.font = "600 13px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("ACCEPTANCE RATE", x + 20, colY + 140);

    ctx.font = "800 26px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(v.rate ? `${v.rate}%` : "N/A", x + 20, colY + 172);

    // Short title
    ctx.font = "400 13px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#64748b";
    let vt = v.title;
    while (ctx.measureText(vt).width > colW - 40 && vt.length > 5) {
      vt = vt.slice(0, -1);
    }
    if (vt !== v.title) vt += "…";
    ctx.fillText(vt, x + 20, colY + 215);
  }
}

function drawMetricBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  note: string
) {
  roundRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Label
  ctx.font = "700 12px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(label, x + 24, y + 36);

  // Value
  ctx.font = "800 36px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#38bdf8";
  ctx.fillText(value, x + 24, y + 84);

  // Note
  ctx.font = "500 13px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(note, x + 24, y + 120);
}
