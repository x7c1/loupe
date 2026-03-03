import { FlatItem } from "./types";

/**
 * Find the index of the first non-directory item.
 * Falls back to 0 if all items are directories.
 */
export function firstFileIndex(items: FlatItem[]): number {
  if (items.length === 0) return -1;
  const idx = items.findIndex(item => !item.isDir);
  return idx !== -1 ? idx : 0;
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

/**
 * Find the index of the next non-directory item after the current position.
 * Wraps around to the beginning when reaching the end.
 */
export function nextFileOnlyIndex(items: FlatItem[], current: number): number {
  for (let i = 1; i <= items.length; i++) {
    const idx = (current + i) % items.length;
    if (!items[idx].isDir) return idx;
  }
  return current;
}

/**
 * Find the index of the previous non-directory item before the current position.
 * Wraps around to the end when reaching the beginning.
 */
export function prevFileOnlyIndex(items: FlatItem[], current: number): number {
  for (let i = 1; i <= items.length; i++) {
    const idx = (current - i + items.length) % items.length;
    if (!items[idx].isDir) return idx;
  }
  return current;
}
