import { allSites, REQUIRED_KEYS } from 'sites';

for (const site of Object.values(allSites)) {
  describe(site.name, () => {
    it('has the minimum required keys', () => {
      const props = Object.getOwnPropertyNames(site);
      for (const key of REQUIRED_KEYS) {
        expect(props).toContain(key);
        expect(site).toHaveProperty(key);
      }
    });

    it('has a valid template URL', () => {
      expect(site.url).toContain('{}');

      // Quick check that it only contains 1 {} since we don't do global replace in ThirdPartyAccount
      expect(site.url.split('{}')).toHaveLength(2);
    });

    it('has a claimed username', () => {
      expect(site.username_claimed).toBeDefined();
      expect(site.username_claimed.length).toBeGreaterThan(0);
    });

    it('has an unclaimed username', () => {
      expect(site.username_unclaimed).toBeDefined();
      expect(site.username_unclaimed.length).toBeGreaterThan(0);
    });
  });
}
