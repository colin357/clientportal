'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { getDrivePreviewUrl, isDriveLink } from '@/lib/driveLinks';

type Props = {
  url?: string | null;
  type?: string | null;
  /** Called when a (non-Drive) image is clicked, e.g. to open a lightbox. */
  onImageClick?: (url: string) => void;
  /** Tailwind max-height for direct images/videos. */
  maxHeightClass?: string;
};

// Shows a calendar event's media. Google Drive links are embedded with Drive's
// own player (a share link is a web page, so <img>/<video> can't load it).
// Other URLs keep the original behaviour: <img> for images, <video> for videos.
export default function EventMediaPreview({ url, type, onImageClick, maxHeightClass = 'max-h-64' }: Props) {
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
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
          Open in Google Drive
        </a>
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
