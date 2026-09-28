import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

const GAP = 12;

/** Columns for a width: two on a phone, up to five on a wide screen. */
const lanesFor = (width: number) => (width < 520 ? 2 : width < 820 ? 3 : width < 1180 ? 4 : 5);

type Props<T> = {
  items: T[];
  getKey: (item: T) => string;
  /** Height over width. */
  ratio: (item: T) => number;
  render: (item: T) => ReactNode;
  /** Near the last item: load the next page. */
  onEnd?: () => void;
};

/**
 * A virtualized masonry: items keep their own proportions and each goes into the shortest
 * column, and only those near the viewport are in the page — thousands of files scroll
 * like a few. The page scrolls; this follows the window.
 */
export function Masonry<T>(props: Props<T>) {
  const parent = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, top: 0 });

  useLayoutEffect(() => {
    const element = parent.current;
    if (!element) return;
    const update = () =>
      setBox((current) => {
        const width = element.clientWidth;
        const top = Math.round(element.getBoundingClientRect().top + window.scrollY);
        return current.width === width && current.top === top ? current : { width, top };
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    // What is above the grid (uploads, groups) moves it down without resizing it.
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const lanes = lanesFor(box.width);
  const column = Math.floor((box.width - GAP * (lanes - 1)) / lanes);
  return (
    <div ref={parent} className="w-full">
      {box.width > 0 && (
        // A new column width or a file added at the top lays everything out again.
        <Lanes
          key={`${lanes}:${column}:${props.items[0] ? props.getKey(props.items[0]) : ""}`}
          {...props}
          lanes={lanes}
          column={column}
          top={box.top}
        />
      )}
    </div>
  );
}

function Lanes<T>({
  items,
  getKey,
  ratio,
  render,
  onEnd,
  lanes,
  column,
  top,
}: Props<T> & { lanes: number; column: number; top: number }) {
  // The virtualizer changes in place as the page scrolls; the React Compiler would memoize
  // what it returns and freeze the grid.
  "use no memo";
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    getItemKey: (index) => getKey(items[index]),
    estimateSize: (index) => column * Math.min(Math.max(ratio(items[index]), 0.56), 1.78),
    lanes,
    gap: GAP,
    overscan: 8,
    scrollMargin: top,
  });

  const visible = virtualizer.getVirtualItems();
  const last = visible.at(-1)?.index ?? -1;
  useEffect(() => {
    if (onEnd && items.length && last >= items.length - 10) onEnd();
  }, [last, items.length, onEnd]);

  return (
    <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {visible.map((row) => (
        <div
          key={row.key}
          className="absolute"
          style={{
            top: row.start - top,
            left: row.lane * (column + GAP),
            width: column,
            height: row.size,
          }}
        >
          {render(items[row.index])}
        </div>
      ))}
    </div>
  );
}
