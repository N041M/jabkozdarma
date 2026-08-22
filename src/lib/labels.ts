import type { AccessType, FlagReason, RipenessState, Tree, TreeReport } from './types';
import { ripenessColors } from '@/constants/theme';
import { monthShort, t } from './i18n';

export const accessLabels: Record<AccessType, string> = {
  public: t('access_public'),
  roadside: t('access_roadside'),
  ask_owner: t('access_ask_owner'),
};

export const ripenessLabels: Record<RipenessState, string> = {
  flowering: t('state_flowering'),
  unripe: t('state_unripe'),
  ripe: t('state_ripe'),
  past: t('state_past'),
  bare: t('state_bare'),
};

export const flagLabels: Record<FlagReason, string> = {
  gone: t('flag_gone'),
  duplicate: t('flag_duplicate'),
  private: t('flag_private'),
  wrong_info: t('flag_wrong_info'),
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

export function seasonLabel(tree: Tree): string | null {
  if (!tree.seasonStart || !tree.seasonEnd) return null;
  return `${monthShort(tree.seasonStart)} – ${monthShort(tree.seasonEnd)}`;
}

export function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return t('today');
  if (days === 1) return t('yesterday');
  if (days < 30) return t('daysAgo', { n: days });
  const months = Math.floor(days / 30);
  return months === 1 ? t('monthAgo') : t('monthsAgo', { n: months });
}

/** Rough meters between two coordinates, good enough for duplicate warnings. */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * 111_320;
  const dLng = (bLng - aLng) * 111_320 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
