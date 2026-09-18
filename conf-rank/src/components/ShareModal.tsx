/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useRef, useState } from "react";

export interface ShareModalProps {
  blob: Blob;
  title: string;
  shareUrl: string;
  filename: string;
  onClose: () => void;
}

export default function ShareModal({
  blob,
  title,
  shareUrl,
  filename,
  onClose,
}: ShareModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [canCopyImage, setCanCopyImage] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setImageUrl(url);

    // Check if ClipboardItem / image copying is supported
    if (
      typeof window !== "undefined" &&
      typeof ClipboardItem !== "undefined" &&
      typeof navigator.clipboard?.write === "function"
    ) {
      setCanCopyImage(true);
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  // Accessibility: focus trap, Escape key, and body scroll-lock
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, [onClose]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyImage = async () => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    } catch (err) {
      console.warn("Could not copy image to clipboard", err);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `Check out ${title} on ConferenceRank:`
  )}&url=${encodeURIComponent(shareUrl)}`;

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Share findings"
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
              <span>📤</span>
              <span>Share Findings</span>
            </h2>
            <p className="text-xs text-muted">
              Branded summary card ready to post, send, or download.
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close share dialog"
            className="rounded-lg p-2 text-muted hover:bg-stone-100 hover:text-foreground dark:hover:bg-stone-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Live Preview Card */}
        <div className="mt-5 space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-stone-950 shadow-md">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={title}
                className="w-full h-auto block aspect-[1200/630] object-cover"
              />
            ) : (
              <div className="aspect-[1200/630] flex items-center justify-center text-xs text-muted">
                Generating card snapshot…
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {canCopyImage && (
              <button
                type="button"
                onClick={handleCopyImage}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-accent-contrast hover:bg-accent-hover transition shadow-xs"
              >
                <span>{copiedImage ? "✓" : "📋"}</span>
                <span>{copiedImage ? "Copied Image!" : "Copy Image"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-foreground hover:border-accent hover:text-accent transition shadow-2xs ${
                !canCopyImage ? "sm:col-span-2 bg-accent text-accent-contrast border-transparent hover:bg-accent-hover hover:text-accent-contrast" : ""
              }`}
            >
              <span>📥</span>
              <span>Download PNG</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-foreground hover:border-stone-400 dark:hover:border-stone-600 transition shadow-2xs"
            >
              <span>{copiedLink ? "✓" : "🔗"}</span>
              <span>{copiedLink ? "Link Copied!" : "Copy Link"}</span>
            </button>
          </div>

          {/* Social Links */}
          <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted">
            <span>Share directly on social:</span>
            <div className="flex items-center gap-2">
              <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 font-semibold text-foreground hover:border-sky-400 hover:text-sky-500 transition"
              >
                <span>Post on X</span>
                <span>↗</span>
              </a>
              <a
                href={linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 font-semibold text-foreground hover:border-blue-500 hover:text-blue-600 transition"
              >
                <span>LinkedIn</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
