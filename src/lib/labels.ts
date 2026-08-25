import type { AccessType, FlagReason, RipenessState, Species, Tree, TreeReport } from './types';
import { ripenessColors } from '@/constants/theme';
import { monthShort, t } from './i18n';
import { VERIFY, type ConfirmRejection, type PinRejection } from './verification';

export const accessLabels: Record<AccessType, string> = {
  public: t('access_public'),
  roadside: t('access_roadside'),
  ask_owner: t('access_ask_owner'),
};

export const speciesLabels: Record<Species, string> = {
  apple: t('species_apple'),
  pear: t('species_pear'),
  plum: t('species_plum'),
  cherry: t('species_cherry'),
  walnut: t('species_walnut'),
  other: t('species_other'),
};

/** Heading for a tree: its variety if known, otherwise the species. */
export function treeTitle(tree: Tree): string {
  return tree.variety ?? speciesLabels[tree.species] ?? speciesLabels.other;
}

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

/**
 * Why a write was refused, in words. Functions rather than the record the
 * other labels use, because these interpolate the thresholds themselves —
 * "within 60 m" has to move when `VERIFY.confirmRadiusM` does.
 */
export function pinRejectionLabel(reason: PinRejection): string {
  switch (reason) {
    case 'too_close':
      return t('pin_too_close', { m: VERIFY.minSelfDistanceM });
    case 'daily_limit':
      return t('pin_daily_limit', { n: VERIFY.dailyPinLimit });
    case 'out_of_area':
      return t('pin_out_of_area');
    case 'placed_too_far':
      return t('pin_placed_too_far', { m: VERIFY.maxPlacementM });
    case 'bad_fix':
      return t('pin_bad_fix');
    case 'bad_coords':
      return t('pin_bad_coords');
    case 'no_profile':
      return t('pin_no_profile');
  }
}

export function confirmRejectionLabel(reason: ConfirmRejection): string {
  switch (reason) {
    case 'too_far':
      return t('confirm_too_far', { m: VERIFY.confirmRadiusM });
    case 'own_tree':
      return t('confirm_own_tree');
    case 'already_confirmed':
      return t('confirm_already_confirmed');
    case 'no_fix':
      return t('confirm_no_fix');
    case 'bad_fix':
      return t('confirm_bad_fix');
    case 'daily_limit':
      return t('confirm_daily_limit');
    case 'no_such_tree':
      return t('confirm_no_such_tree');
    case 'no_profile':
      return t('confirm_no_profile');
    case 'sync_failed':
      return t('confirm_sync_failed');
  }
}

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

