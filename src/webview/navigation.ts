import { FlatItem } from "./types";

/**
 * Find the index of the first file (non-directory) item.
 */
export function firstFileIndex(items: FlatItem[]): number {
  for (let i = 0; i < items.length; i++) {
    if (!items[i].isDir) return i;
  }
  return -1;
}

/**
 * Find the index of the next file item after the current position.
 */
export function nextFileIndex(items: FlatItem[], current: number): number {
  for (let i = current + 1; i < items.length; i++) {
    if (!items[i].isDir) return i;
  }
  return current;
}

/**
 * Find the index of the previous file item before the current position.
 */
export function prevFileIndex(items: FlatItem[], current: number): number {
  for (let i = current - 1; i >= 0; i--) {
    if (!items[i].isDir) return i;
  }
  return -1;
}
