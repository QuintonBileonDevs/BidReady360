import { referenceRepository, clearReferenceCache, FullReferenceData } from '../repositories/reference.repository';

/**
 * Thin coordinator delegating reference queries and cache management to ReferenceRepository.
 * Never caches failed or empty database responses.
 */
class ReferenceDataLoader {
  async getReferenceData(): Promise<FullReferenceData> {
    return referenceRepository.loadAll();
  }

  async refreshCache(): Promise<FullReferenceData> {
    clearReferenceCache();
    return referenceRepository.loadAll();
  }
}

export const referenceDataLoader = new ReferenceDataLoader();
export { clearReferenceCache };
