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

    it('has a template URL', () => {
      expect(site.url).toContain('{}');
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
