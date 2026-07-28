"use client";

import Image from "next/image";
import { useState } from "react";
import { DotLoader } from "@/components/dot-loader";

function ArtworkImage({ src, label }: { src: string; label: string }) {
  const [loading, setLoading] = useState(true);

  return (
    <>
      {loading && <div className="pixel-art-loader"><DotLoader label={`Loading ${label}`} compact /></div>}
      <Image
        src={src}
        alt={label}
        fill
        unoptimized
        sizes="(max-width: 768px) 80vw, 32vw"
        className={loading ? "loading" : "loaded"}
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
    </>
  );
}

export function PixelArtwork({
  variant = 0,
  className = "",
  label = "Maskborn artwork",
  source,
}: {
  variant?: number;
  className?: string;
  label?: string;
  source?: string;
}) {
  const fixture = String((variant % 16) + 1).padStart(4, "0");
  const src = source ?? `/collection/fixtures/token-${fixture}.svg`;

  return (
    <div className={`pixel-art ${className}`}>
      <ArtworkImage key={src} src={src} label={label} />
    </div>
  );
}
