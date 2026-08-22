import { create } from 'zustand';
import type { TrainingPlan, TrainingDay } from '../types';
import {
  getAllPlans,
  getCurrentPlan,
  addPlan as dbAddPlan,
  updatePlan as dbUpdatePlan,
  deletePlan as dbDeletePlan,
  setCurrentPlan as dbSetCurrentPlan,
} from '../db';
import { createPlanFromTemplate, createEmptyPlan, getCurrentISOString } from '../utils/helpers';
import { findNextActiveDayIndex } from '../domain/trainingPlan';

interface PlanState {
  plans: TrainingPlan[];
  currentPlan: TrainingPlan | null;
  isLoading: boolean;
  initialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  loadPlans: () => Promise<void>;
  addPlan: (plan: TrainingPlan) => Promise<void>;
  createFromTemplate: (template: Omit<TrainingPlan, 'id' | 'createdAt' | 'updatedAt'>, customName?: string) => Promise<void>;
  createEmpty: (name: string) => Promise<void>;
  updatePlan: (id: string, updates: Partial<TrainingPlan>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  setCurrentPlan: (id: string) => Promise<void>;
  renamePlan: (id: string, newName: string) => Promise<void>;
  toggleDayActive: (planId: string, dayId: string) => Promise<void>;
  updateDay: (planId: string, dayId: string, updates: Partial<TrainingDay>) => Promise<void>;
  advanceToNextDay: (planId: string) => Promise<void>;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: [],
  currentPlan: null,
  isLoading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;
    await get().loadPlans();
    set({ initialized: true });
  },

  loadPlans: async () => {
    set({ isLoading: true });
    try {
      const [plans, current] = await Promise.all([
        getAllPlans(),
        getCurrentPlan(),
      ]);
      set({ plans, currentPlan: current || null });
    } finally {
      set({ isLoading: false });
    }
  },

  addPlan: async (plan) => {
    await dbAddPlan(plan);
    await get().loadPlans();
  },

  createFromTemplate: async (template, customName) => {
    const plan = createPlanFromTemplate(template, customName);
    await dbAddPlan(plan);
    // 自动设置为当前计划
    await dbSetCurrentPlan(plan.id);
    await get().loadPlans();
  },

  createEmpty: async (name) => {
    const plan = createEmptyPlan(name);
    await dbAddPlan(plan);
    await get().loadPlans();
  },

  updatePlan: async (id, updates) => {
    const updated = { ...updates, updatedAt: getCurrentISOString() };
    await dbUpdatePlan(id, updated);
    await get().loadPlans();
  },

  deletePlan: async (id) => {
    await dbDeletePlan(id);
    await get().loadPlans();
  },

  setCurrentPlan: async (id) => {
    await dbSetCurrentPlan(id);
    await get().loadPlans();
  },

  renamePlan: async (id, newName) => {
    await get().updatePlan(id, { name: newName });
  },

  toggleDayActive: async (planId, dayId) => {
    const plan = get().plans.find(p => p.id === planId);
    if (!plan) return;

    const updatedDays = plan.days.map(day =>
      day.id === dayId ? { ...day, isActive: !day.isActive } : day
    );
    await get().updatePlan(planId, { days: updatedDays });
  },

  updateDay: async (planId, dayId, updates) => {
    const plan = get().plans.find(p => p.id === planId);
    if (!plan) return;

    const updatedDays = plan.days.map(day =>
      day.id === dayId ? { ...day, ...updates } : day
    );
    await get().updatePlan(planId, { days: updatedDays });
  },

  advanceToNextDay: async (planId) => {
    const plan = get().plans.find(p => p.id === planId);
    if (!plan || plan.days.length === 0) return;

    const currentIdx = plan.currentDayIndex ?? 0;
    const nextIdx = findNextActiveDayIndex(plan.days, currentIdx);
    if (nextIdx === null) return;

    await get().updatePlan(planId, { currentDayIndex: nextIdx });
  },
}));
