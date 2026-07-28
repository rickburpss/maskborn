import { beforeEach, describe, expect, it } from "vitest";
import { useDraftStore } from "./draft";

describe("draw history", () => {
  beforeEach(() => {
    useDraftStore.getState().reset();
  });

  it("undoes and redoes an entire brush stroke", () => {
    const draft = useDraftStore.getState();
    draft.beginStroke();
    draft.paintPixels([{ x: 2, y: 3 }, { x: 3, y: 3 }]);
    useDraftStore.getState().endStroke();
    expect(useDraftStore.getState().layers[0].pixels).toHaveLength(2);

    useDraftStore.getState().undo();
    expect(useDraftStore.getState().layers[0].pixels).toHaveLength(0);

    useDraftStore.getState().redo();
    expect(useDraftStore.getState().layers[0].pixels).toHaveLength(2);
  });

  it("ignores invalid cells and does not save a no-op stroke", () => {
    const draft = useDraftStore.getState();
    draft.beginStroke();
    draft.paintPixels([{ x: -1, y: 0 }, { x: 32, y: 31 }]);
    useDraftStore.getState().endStroke();
    expect(useDraftStore.getState().layers[0].pixels).toHaveLength(0);
    expect(useDraftStore.getState().past).toHaveLength(0);

    useDraftStore.getState().beginStroke();
    useDraftStore.getState().paintPixels([{ x: 1, y: 1 }]);
    useDraftStore.getState().endStroke();
    const afterPaint = useDraftStore.getState();

    afterPaint.beginStroke();
    afterPaint.paintPixels([{ x: 1, y: 1 }]);
    useDraftStore.getState().endStroke();
    expect(useDraftStore.getState().past).toHaveLength(afterPaint.past.length);
    expect(useDraftStore.getState().updatedAt).toBe(afterPaint.updatedAt);
  });
});
