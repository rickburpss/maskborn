"use client";

import { AnimatePresence, motion, type PanInfo, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PixelArtwork } from "@/components/pixel-artwork";
import collection from "@/generated/collection.json";

const offsetFor = (index: number, active: number, count: number) => {
  let offset = index - active;
  if (offset > count / 2) offset -= count;
  if (offset < -count / 2) offset += count;
  return offset;
};

export function FeaturedCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const reduceMotion = useReducedMotion();
  const featured = useMemo(() => {
    const legends = ["red-panda", "skunk"].map((slug) => {
      const item = collection.legends.find((legend) => legend.slug === slug)!;
      return { ...item, kind: "1/1" as const };
    });
    const generated = collection.fixtures.slice(0, 6).map((fixture) => ({
      index: fixture.id,
      name: `Generated #${String(fixture.id).padStart(4, "0")}`,
      slug: `generated-${fixture.id}`,
      preview: fixture.preview,
      note: "A normal generator combination.",
      kind: "Generated" as const,
    }));
    return [...legends, ...generated];
  }, []);
  const count = featured.length;

  const move = useCallback((direction: number) => {
    setActive((current) => (current + direction + count) % count);
  }, [count]);

  useEffect(() => {
    if (paused || interacting || reduceMotion) return;
    const id = window.setInterval(() => move(1), 4200);
    return () => window.clearInterval(id);
  }, [paused, interacting, reduceMotion, move]);

  const finishDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setInteracting(false);
    if (Math.abs(info.offset.x) > 35 || Math.abs(info.velocity.x) > 300) move(info.offset.x < 0 ? 1 : -1);
  };

  return (
    <section className="featured" aria-roledescription="carousel" aria-label="Collection previews">
      <div
        className="carousel-stage"
        onMouseEnter={() => setInteracting(true)}
        onMouseLeave={() => setInteracting(false)}
      >
        {featured.map((artwork, index) => {
          const offset = offsetFor(index, active, count);
          const distance = Math.abs(offset);
          const visible = distance <= 2;
          return (
            <motion.article
              key={artwork.slug}
              className={`featured-card ${offset === 0 ? "is-active" : ""}`}
              drag={offset === 0 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.14}
              onDragStart={() => setInteracting(true)}
              onDragEnd={finishDrag}
              onClick={() => offset !== 0 && setActive(index)}
              animate={{
                x: `${offset * 70}%`,
                scale: offset === 0 ? 1 : distance === 1 ? 0.78 : 0.58,
                opacity: visible ? (distance === 2 ? 0.55 : 1) : 0,
                zIndex: 10 - distance,
              }}
              transition={{ type: "spring", stiffness: 220, damping: 28, mass: 0.9 }}
              aria-hidden={!visible}
            >
              <Link href={artwork.kind === "1/1" ? `/collection#${artwork.slug}` : "/collection"} tabIndex={offset === 0 ? 0 : -1}>
                <PixelArtwork source={artwork.preview} label={artwork.name} />
                <AnimatePresence>
                  {offset === 0 && (
                    <motion.div className="featured-meta" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <span>{artwork.kind}</span>
                      <h2>{artwork.name}</h2>
                      <p>Pre-launch collection preview</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Link>
            </motion.article>
          );
        })}
      </div>
      <div className="carousel-controls">
        <button className="round-control" onClick={() => move(-1)} aria-label="Previous artwork"><ChevronLeft /></button>
        <button className="pause-control" onClick={() => setPaused((value) => !value)}>
          {paused ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
          {paused ? "Resume" : "Pause"}
        </button>
        <span className="carousel-count"><b>{String(active + 1).padStart(2, "0")}</b> / {String(count).padStart(2, "0")}</span>
        <button className="round-control" onClick={() => move(1)} aria-label="Next artwork"><ChevronRight /></button>
      </div>
    </section>
  );
}
