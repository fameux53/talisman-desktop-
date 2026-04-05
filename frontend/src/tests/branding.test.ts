import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Branding', () => {
  it('no MarketMama references in source files', () => {
    function scanDir(dir: string): string[] {
      const findings: string[] = [];
      try {
        const files = readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          if (file.name === 'node_modules' || file.name === '.git' || file.name === 'docs') continue;
          const path = join(dir, file.name);
          if (file.isDirectory()) {
            findings.push(...scanDir(path));
          } else if (file.name.match(/\.(ts|tsx|json)$/) && !file.name.includes('.test.')) {
            const content = readFileSync(path, 'utf-8');
            if (content.includes('MarketMama') || content.includes('marketmama')) {
              // Exclude migration code that intentionally references old names
              if (file.name === 'main.tsx' && content.includes('migrateLocalStorage')) continue;
              findings.push(`${path}: contains MarketMama reference`);
            }
          }
        }
      } catch { /* directory not accessible */ }
      return findings;
    }

    const findings = scanDir(join(__dirname, '../'));
    expect(findings).toEqual([]);
  });

  it('i18n keys are balanced across languages', () => {
    const countKeys = (file: string) => {
      const content = JSON.parse(readFileSync(file, 'utf-8'));
      return Object.keys(content).length;
    };

    const i18nDir = join(__dirname, '../i18n');
    const htKeys = countKeys(join(i18nDir, 'ht.json'));
    const frKeys = countKeys(join(i18nDir, 'fr.json'));
    const enKeys = countKeys(join(i18nDir, 'en.json'));

    expect(htKeys).toBe(frKeys);
    expect(htKeys).toBe(enKeys);
  });
});
