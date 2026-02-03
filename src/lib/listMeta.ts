/**
 * List Metadata Storage (localStorage)
 * PRODUCT_SPEC Stage 4.2: Notes & Tags for Lead Lists
 * 
 * Stores per-list metadata (notes, tags) in localStorage.
 * No backend required - purely client-side storage.
 */

const STORAGE_KEY = 'lh_list_meta_v1';

export type ListTag = 'hot' | 'cold' | 'followup' | null;

export interface ListMeta {
    notes: string;
    tag: ListTag;
    updatedAt: string;
}

interface StorageData {
    [listId: string]: ListMeta;
}

/**
 * Read all metadata from localStorage
 */
function readStorage(): StorageData {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch (error) {
        console.error('[listMeta] Failed to read storage:', error);
        return {};
    }
}

/**
 * Write all metadata to localStorage
 */
function writeStorage(data: StorageData): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('[listMeta] Failed to write storage:', error);
    }
}

/**
 * Get metadata for a specific list
 * Returns empty defaults if not found
 */
export function getListMeta(listId: string): ListMeta {
    const data = readStorage();
    return data[listId] || { notes: '', tag: null, updatedAt: new Date().toISOString() };
}

/**
 * Set notes for a specific list
 */
export function setListNotes(listId: string, notes: string): void {
    const data = readStorage();
    const existing = data[listId] || { notes: '', tag: null, updatedAt: '' };

    data[listId] = {
        ...existing,
        notes,
        updatedAt: new Date().toISOString(),
    };

    writeStorage(data);
}

/**
 * Set tag for a specific list
 */
export function setListTag(listId: string, tag: ListTag): void {
    const data = readStorage();
    const existing = data[listId] || { notes: '', tag: null, updatedAt: '' };

    data[listId] = {
        ...existing,
        tag,
        updatedAt: new Date().toISOString(),
    };

    writeStorage(data);
}

/**
 * Clear all metadata for a specific list
 */
export function clearListMeta(listId: string): void {
    const data = readStorage();
    delete data[listId];
    writeStorage(data);
}
