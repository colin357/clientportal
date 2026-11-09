'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { getDriveImageUrl, getDrivePreviewUrl, isDriveLink } from '@/lib/driveLinks';

type Props = {
  url?: string | null;
  type?: string | null;
  /** Every slide of a carousel post, in order. When it has 2+ links a swipeable carousel is shown. */
  urls?: string[] | null;
  /** Called when a (non-Drive) image is clicked, e.g. to open a lightbox. */
  onImageClick?: (url: string) => void;
  /** Tailwind max-height for direct images/videos. */
  maxHeightClass?: string;
};

// Shows a calendar event's media. Google Drive links are embedded with Drive's
// own player (a share link is a web page, so <img>/<video> can't load it).
// Other URLs keep the original behaviour: <img> for images, <video> for videos.
// Carousel posts (several slide links) are shown one slide at a time, like Instagram.
export default function EventMediaPreview({ url, type, urls, onImageClick, maxHeightClass = 'max-h-64' }: Props) {
  if (urls && urls.length > 1) {
    return <CarouselPreview urls={urls} />;
  }

  if (!url) return null;

  if (isDriveLink(url)) {
    const previewUrl = getDrivePreviewUrl(url);
    return (
      <div>
        {previewUrl && (
          <div className="relative w-full overflow-hidden rounded-lg border bg-black" style={{ height: 480 }}>
            <iframe
              src={previewUrl}
              title="Post preview"
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </div>
        )}
        <OpenLink href={url} />
      </div>
    );
  }

  if (type === 'video') {
    return <video src={url} className={`w-full ${maxHeightClass} rounded-lg border`} controls />;
  }

  return (
    <div>
      <img
        src={url}
        alt="Post media"
        className={`w-full ${maxHeightClass} object-cover rounded-lg border ${onImageClick ? 'cursor-zoom-in hover:opacity-90 transition-opacity' : ''}`}
        onClick={onImageClick ? (e) => { e.stopPropagation(); onImageClick(url); } : undefined}
      />
      {onImageClick && <p className="text-xs text-gray-400 mt-1 text-center">Click image to view full size</p>}
    </div>
  );
}

function OpenLink({ href, label = 'Open in Google Drive' }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink className="w-4 h-4" />
      {label}
    </a>
  );
}

function CarouselPreview({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0);
  // Slides whose direct image failed to load fall back to Drive's viewer.
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const touchStartX = useRef<number | null>(null);
  const count = urls.length;

  useEffect(() => {
    setIndex(0);
    setFailed({});
  }, [urls.join('|')]);

  const go = (next: number) => setIndex(Math.max(0, Math.min(count - 1, next)));
  const current = urls[index];

  const renderSlide = (slideUrl: string, i: number) => {
    const imageUrl = isDriveLink(slideUrl) ? getDriveImageUrl(slideUrl) : slideUrl;
    if (imageUrl && !failed[i]) {
      return (
        <img
          src={imageUrl}
          alt={`Slide ${i + 1} of ${count}`}
          className="absolute inset-0 w-full h-full object-contain select-none"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setFailed((f) => ({ ...f, [i]: true }))}
        />
      );
    }
    const previewUrl = getDrivePreviewUrl(slideUrl);
    return previewUrl ? (
      <iframe src={previewUrl} title={`Slide ${i + 1}`} className="absolute inset-0 w-full h-full" allowFullScreen />
    ) : null;
  };

  return (
    <div>
      <div
        className="relative w-full overflow-hidden rounded-lg border bg-black mx-auto"
        style={{ aspectRatio: '4 / 5', maxHeight: 520, maxWidth: 416 }}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        {renderSlide(current, index)}

        <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {index + 1} / {count}
        </span>

        {index > 0 && (
          <button
            type="button"
            aria-label="Previous slide"
            onClick={(e) => { e.stopPropagation(); go(index - 1); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1 shadow hover:bg-white"
          >
            <ChevronLeft className="w-5 h-5 text-gray-800" />
          </button>
        )}
        {index < count - 1 && (
          <button
            type="button"
            aria-label="Next slide"
            onClick={(e) => { e.stopPropagation(); go(index + 1); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1 shadow hover:bg-white"
          >
            <ChevronRight className="w-5 h-5 text-gray-800" />
          </button>
        )}
      </div>

      <div className="mt-2 flex justify-center gap-1.5">
        {urls.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={(e) => { e.stopPropagation(); go(i); }}
            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-blue-600' : 'w-1.5 bg-gray-300 hover:bg-gray-400'}`}
          />
        ))}
      </div>

      {/* Preload the next slide so swiping feels instant. */}
      {index < count - 1 && isDriveLink(urls[index + 1]) && (
        <img src={getDriveImageUrl(urls[index + 1]) || undefined} alt="" className="hidden" referrerPolicy="no-referrer" />
      )}

      {isDriveLink(current) && <OpenLink href={current} label={`Open slide ${index + 1} in Google Drive`} />}
    </div>
  );
}
