import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, WeightUnit, DistanceUnit } from '../types';
import { getSettings, updateSettings, initDefaultSettings } from '../db';

interface SettingsState extends AppSettings {
  isLoading: boolean;
  initialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  setDistanceUnit: (unit: DistanceUnit) => Promise<void>;
  setDarkMode: (enabled: boolean) => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      weightUnit: 'kg',
      distanceUnit: 'km',
      darkMode: false,
      schemaVersion: 1,
      isLoading: false,
      initialized: false,

      initialize: async () => {
        if (get().initialized) return;
        set({ isLoading: true });
        try {
          await initDefaultSettings();
          await get().loadSettings();
          set({ initialized: true });
        } finally {
          set({ isLoading: false });
        }
      },

      loadSettings: async () => {
        const settings = await getSettings();
        if (settings) {
          set({
            weightUnit: settings.weightUnit,
            distanceUnit: settings.distanceUnit,
            darkMode: settings.darkMode,
            schemaVersion: settings.schemaVersion,
          });
        }
      },

      setWeightUnit: async (unit) => {
        set({ weightUnit: unit });
        await updateSettings({ weightUnit: unit });
      },

      setDistanceUnit: async (unit) => {
        set({ distanceUnit: unit });
        await updateSettings({ distanceUnit: unit });
      },

      setDarkMode: async (enabled) => {
        set({ darkMode: enabled });
        await updateSettings({ darkMode: enabled });
      },
    }),
    {
      name: 'vibefit-settings',
      partialize: (state) => ({
        weightUnit: state.weightUnit,
        distanceUnit: state.distanceUnit,
        darkMode: state.darkMode,
      }),
    }
  )
);
