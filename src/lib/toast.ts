import type Ionicons from '@expo/vector-icons/Ionicons';
import { create } from 'zustand';

/**
 * The feedback channel for every reward. Transient and deliberately outside
 * the persisted app store — a toast that survived a reload would be a bug.
 */

export type IconName = keyof typeof Ionicons.glyphMap;

export interface ToastMessage {
  /** Bumped on every raise so an identical message still re-animates. */
  id: number;
  message: string;
  icon: IconName;
}

interface ToastState {
  toast: ToastMessage | null;
  show: (message: string, icon?: IconName) => void;
  dismiss: () => void;
}

let nextId = 1;

export const useToast = create<ToastState>((set) => ({
  toast: null,
  show: (message, icon = 'checkmark-circle') => set({ toast: { id: nextId++, message, icon } }),
  dismiss: () => set({ toast: null }),
}));

/** How long a toast stays up before it dismisses itself. */
export const TOAST_MS = 2800;
