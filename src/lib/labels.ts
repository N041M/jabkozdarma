import type { AccessType, FlagReason, RipenessState, Tree, TreeReport } from './types';
import { ripenessColors } from '@/constants/theme';

export const accessLabels: Record<AccessType, string> = {
  public: 'Public land',
  roadside: 'Roadside',
  ask_owner: 'Ask the owner',
};

export const ripenessLabels: Record<RipenessState, string> = {
  flowering: 'Flowering',
  unripe: 'Unripe',
  ripe: 'Ripe now',
  past: 'Past ripe',
  bare: 'Bare',
};

export const flagLabels: Record<FlagReason, string> = {
  gone: 'Tree is gone',
  duplicate: 'Duplicate pin',
  private: 'On private land',
  wrong_info: 'Wrong info',
};

export function latestReport(treeId: string, reports: TreeReport[]): TreeReport | null {
  let latest: TreeReport | null = null;
  for (const r of reports) {
    if (r.treeId !== treeId) continue;
    if (!latest || r.createdAt > latest.createdAt) latest = r;
  }
  return latest;
}

export function pinColor(tree: Tree, reports: TreeReport[]): string {
  const latest = latestReport(tree.id, reports);
  return ripenessColors[latest?.state ?? 'none'];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function seasonLabel(tree: Tree): string | null {
  if (!tree.seasonStart || !tree.seasonEnd) return null;
  return `${MONTHS[tree.seasonStart - 1]} – ${MONTHS[tree.seasonEnd - 1]}`;
}

export function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

/** Rough meters between two coordinates, good enough for duplicate warnings. */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * 111_320;
  const dLng = (bLng - aLng) * 111_320 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
