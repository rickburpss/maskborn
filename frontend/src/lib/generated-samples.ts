import collection from "@/generated/collection.json";
import type { TraitSelection } from "@/lib/maskborn-renderer";

const extraCount = 32;

export function sampleSelection(id: number): TraitSelection {
  return collection.categories.map((category, index) =>
    ((id * [7, 11, 13, 17, 19, 23, 29, 31][index]!) + index * 5) % category.count,
  ) as TraitSelection;
}

export const collectionSamples = [
  ...collection.fixtures.map((fixture) => ({
    id: fixture.id,
    traits: fixture.traits as TraitSelection,
    preview: fixture.preview,
  })),
  ...Array.from({ length: extraCount }, (_, index) => {
    const id = collection.fixtures.length + index + 1;
    return {
      id,
      traits: sampleSelection(id),
      preview: `/collection/sample/${id}`,
    };
  }),
];
