import { referenceRepository, FullReferenceData } from '../repositories/reference.repository';

/**
 * Singleton in-memory cache for reference data.
 * Loaded on process startup and refreshed on demand or via admin webhook.
 */
class ReferenceDataLoader {
  private cache: FullReferenceData | null = null;
  private loadPromise: Promise<FullReferenceData> | null = null;

  /**
   * Initializes the reference cache if not yet loaded.
   */
  async getReferenceData(): Promise<FullReferenceData> {
    if (this.cache) {
      return this.cache;
    }

    if (!this.loadPromise) {
      this.loadPromise = referenceRepository.loadAll().then((data) => {
        this.cache = data;
        this.loadPromise = null;
        console.log(`[REFERENCE LOADER] Successfully loaded and cached ${data.districts.length} districts, ${data.documentTypes.length} doc types, ${data.disciplines.length} disciplines, ${data.plans.length} plans.`);
        return data;
      }).catch((err) => {
        this.loadPromise = null;
        console.error('[REFERENCE LOADER] Failed to load reference data:', err);
        throw err;
      });
    }

    return this.loadPromise;
  }

  /**
   * Force an on-demand cache refresh.
   */
  async refreshCache(): Promise<FullReferenceData> {
    console.log('[REFERENCE LOADER] Invalidation triggered. Reloading reference data from PostgreSQL...');
    this.cache = null;
    this.loadPromise = null;
    return this.getReferenceData();
  }

  // Quick synchronous getters (after initial load)
  getCached(): FullReferenceData | null {
    return this.cache;
  }
}

export const referenceDataLoader = new ReferenceDataLoader();
