import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_PROFILES = 3;

const PERSONAS = [
  {
    id: 'hormozi',
    name: 'Alex Hormozi',
    tagline: 'Direct · Value-First · Urgency',
    description: 'Reframes value immediately. Cuts to ROI. Never defensive.',
    color: '#f4a623',
  },
  {
    id: 'voss',
    name: 'Chris Voss',
    tagline: 'FBI Negotiation · Tactical Empathy',
    description: 'Mirrors. Labels emotions. Never pressures. "That\'s right."',
    color: '#00d4ff',
  },
  {
    id: 'cardone',
    name: 'Grant Cardone',
    tagline: 'Volume · Follow-Up · 10X Energy',
    description: 'Never accept the no. Close again. Massive action energy.',
    color: '#00ff88',
  },
];

export const PERSONAS_MAP = Object.fromEntries(PERSONAS.map(p => [p.id, p]));
export { PERSONAS };

export const useProfileStore = create(
  persist(
    (set, get) => ({
      profiles: [],        // [{ id, name, voice_id, persona, createdAt }]
      activeProfileId: null,
      engineId: null,      // Speech Engine instance ID

      // ── Profile actions ───────────────────────────────────────
      addProfile: (profile) => {
        const profiles = get().profiles;
        if (profiles.length >= MAX_PROFILES) {
          throw new Error(`Maximum ${MAX_PROFILES} profiles allowed`);
        }
        const newProfile = {
          id: crypto.randomUUID(),
          persona: 'hormozi',
          createdAt: new Date().toISOString(),
          ...profile,
        };
        set({ profiles: [...profiles, newProfile] });
        // Auto-activate if first profile
        if (profiles.length === 0) {
          set({ activeProfileId: newProfile.id });
        }
        return newProfile;
      },

      updateProfile: (id, updates) => {
        set(state => ({
          profiles: state.profiles.map(p => p.id === id ? { ...p, ...updates } : p),
        }));
      },

      removeProfile: (id) => {
        set(state => {
          const profiles = state.profiles.filter(p => p.id !== id);
          const activeProfileId = state.activeProfileId === id
            ? (profiles[0]?.id || null)
            : state.activeProfileId;
          return { profiles, activeProfileId };
        });
      },

      setActiveProfile: (id) => set({ activeProfileId: id }),

      getActiveProfile: () => {
        const { profiles, activeProfileId } = get();
        return profiles.find(p => p.id === activeProfileId) || null;
      },

      canAddProfile: () => get().profiles.length < MAX_PROFILES,

      // ── Engine actions ────────────────────────────────────────
      setEngineId: (engineId) => set({ engineId }),

      clearAll: () => set({ profiles: [], activeProfileId: null, engineId: null }),
    }),
    {
      name: 'ghost-profiles',
      version: 1,
    }
  )
);
