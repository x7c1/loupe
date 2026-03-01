import { FlatItem } from "./types";

/**
 * Find the index of the first item.
 */
export function firstFileIndex(items: FlatItem[]): number {
  return items.length > 0 ? 0 : -1;
}

/**
 * Find the index of the next item after the current position.
 * Wraps to the first item when reaching the end.
 */
export function nextFileIndex(items: FlatItem[], current: number): number {
  if (items.length === 0) return -1;
  return current < items.length - 1 ? current + 1 : 0;
}

/**
 * Find the index of the previous item before the current position.
 * Wraps to the last item when reaching the beginning.
 */
export function prevFileIndex(items: FlatItem[], current: number): number {
  if (items.length === 0) return -1;
  return current > 0 ? current - 1 : items.length - 1;
}
