export interface SearchFilters {
    city: string;
    district: string;
    category: string;
    keyword: string;
    minRating: number;
    minReviews: string;
}

export interface SearchPreset {
    id: string;
    name: string;
    createdAt: string;
    filters: SearchFilters;
}

const STORAGE_KEY = 'lh_search_presets_v1';
const MAX_PRESETS = 20;

export function listPresets(): SearchPreset[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data) as SearchPreset[];
    } catch {
        return [];
    }
}

export function savePreset(name: string, filters: SearchFilters): { success: boolean; error?: string } {
    const presets = listPresets();

    if (presets.length >= MAX_PRESETS) {
        return { success: false, error: 'limit_reached' };
    }

    if (presets.some(p => p.name === name)) {
        return { success: false, error: 'already_exists' };
    }

    const newPreset: SearchPreset = {
        id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        createdAt: new Date().toISOString(),
        filters,
    };

    presets.push(newPreset);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return { success: true };
}

export function renamePreset(id: string, newName: string): { success: boolean; error?: string } {
    const presets = listPresets();
    const index = presets.findIndex(p => p.id === id);

    if (index === -1) {
        return { success: false, error: 'not_found' };
    }

    if (presets.some(p => p.name === newName && p.id !== id)) {
        return { success: false, error: 'already_exists' };
    }

    presets[index].name = newName;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return { success: true };
}

export function deletePreset(id: string): boolean {
    const presets = listPresets();
    const filtered = presets.filter(p => p.id !== id);

    if (filtered.length === presets.length) {
        return false;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
}

export function getPreset(id: string): SearchPreset | null {
    const presets = listPresets();
    return presets.find(p => p.id === id) || null;
}
