"use client";

import { useCallback, useState } from "react";
import { business } from "@/lib/business";

export function DemoPlayer({ available }: { available: boolean }) {
  const [failed, setFailed] = useState(false);
  // A source can fail before React hydrates, so inspect the native state on mount.
  const checkInitialError = useCallback((video: HTMLVideoElement | null) => {
    if (video && (video.error || video.networkState === 3)) setFailed(true);
  }, []);
  if (!available) return <div className="video-unavailable"><h2>Demo being added</h2><p>The Mia demo will appear here once the video is available.</p></div>;
  return <div className="video-wrap">
    <video ref={checkInitialError} controls preload="metadata" playsInline poster={business.demo.poster} aria-label={business.demo.title} aria-describedby="demo-description" onError={() => setFailed(true)}>
      <source src={business.demo.path} type="video/mp4" onError={() => setFailed(true)} />
      Your browser cannot play this video. <a href={business.demo.path}>Open the demonstration MP4</a>.
    </video>
    {failed && <p role="alert" className="video-error">The video could not load. <a href={business.demo.path}>Try opening the MP4 directly</a>, or email us from the Contact page.</p>}
  </div>;
}
