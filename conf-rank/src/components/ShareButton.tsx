"use client";

import { useState } from "react";
import { generateShareCardBlob, type ShareCardData } from "@/lib/shareCard";
import ShareModal from "./ShareModal";

export interface ShareButtonProps {
  data: ShareCardData;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  showIconOnly?: boolean;
}

export default function ShareButton({
  data,
  label = "Share",
  className = "",
  size = "md",
  showIconOnly = false,
}: ShareButtonProps) {
  const [loading, setLoading] = useState(false);
  const [modalBlob, setModalBlob] = useState<Blob | null>(null);

  const getShareTitle = () => {
    if (data.type === "venue") {
      return `${data.acronym} — ${data.title}`;
    }
    return data.title;
  };

  const getFilename = () => {
    if (data.type === "venue") {
      return `${data.acronym.toLowerCase()}_conferencerank.png`;
    }
    if (data.type === "comparison") {
      return "conference_comparison_conferencerank.png";
    }
    return "conferencerank_directory.png";
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;
    setLoading(true);

    try {
      const blob = await generateShareCardBlob(data);
      const shareUrl = data.url || (typeof window !== "undefined" ? window.location.href : "");
      const shareTitle = getShareTitle();
      const filename = getFilename();

      // Check for Native OS Share with Image support (mobile / iOS Safari / macOS)
      const file = new File([blob], filename, { type: "image/png" });
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            title: shareTitle,
            text: `Check out ${shareTitle} on ConferenceRank:`,
            files: [file],
            url: shareUrl,
          });
          setLoading(false);
          return;
        } catch (shareErr) {
          // If user cancelled the native sheet, don't force modal; if failed, fallback to modal
          if ((shareErr as Error)?.name === "AbortError") {
            setLoading(false);
            return;
          }
        }
      }

      // Fallback: Open desktop ShareModal with Live Card Preview + Copy Image + Download PNG
      setModalBlob(blob);
    } catch (err) {
      console.error("Failed to generate share card", err);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs gap-1.5",
    md: "px-3 py-1.5 text-xs gap-1.5",
    lg: "px-4 py-2 text-sm gap-2",
  };

  return (
    <>
      <button
        type="button"
        onClick={handleShareClick}
        disabled={loading}
        title="Share branded findings card or link"
        className={`inline-flex items-center justify-center font-semibold rounded-lg transition select-none ${
          sizeClasses[size]
        } ${className}`}
      >
        <span>{loading ? "⏳" : "📤"}</span>
        {!showIconOnly && <span>{loading ? "Preparing…" : label}</span>}
      </button>

      {modalBlob && (
        <ShareModal
          blob={modalBlob}
          title={getShareTitle()}
          shareUrl={data.url || (typeof window !== "undefined" ? window.location.href : "")}
          filename={getFilename()}
          onClose={() => setModalBlob(null)}
        />
      )}
    </>
  );
}
