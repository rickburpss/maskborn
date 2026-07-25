import Image from "next/image";

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
      <Image src={src} alt={label} fill unoptimized sizes="(max-width: 768px) 80vw, 32vw" />
    </div>
  );
}
