let indianCollegeCache: string[] | null = null;
let indianCollegeInFlight: Promise<string[]> | null = null;

const INDIAN_COLLEGE_API = '/api/indian-colleges';

export async function getIndianCollegeNames(limit?: number): Promise<string[]> {
  const applyLimit = (names: string[]) => {
    if (typeof limit === 'number' && limit > 0) {
      return names.slice(0, limit);
    }
    return names;
  };

  if (indianCollegeCache) {
    return applyLimit(indianCollegeCache);
  }

  if (indianCollegeInFlight) {
    return indianCollegeInFlight.then(applyLimit);
  }

  indianCollegeInFlight = fetch(INDIAN_COLLEGE_API)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch colleges: ${response.status}`);
      }

      const data = await response.json();
      const names: string[] = Array.isArray(data?.colleges)
        ? data.colleges
            .map((item: any) => String(item || '').trim())
            .filter(Boolean)
        : [];

      const uniqueSorted: string[] = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
      indianCollegeCache = uniqueSorted;
      return applyLimit(uniqueSorted);
    })
    .catch(() => {
      return [] as string[];
    })
    .finally(() => {
      indianCollegeInFlight = null;
    });

  return indianCollegeInFlight;
}
