import { describe, expect, it } from 'bun:test';
import { FingerprintNormalizer } from '../src/core/fingerprint/normalizer';

describe('FingerprintNormalizer', () => {
  it('should generate identical fingerprints for code varying only in whitespace and indentation', () => {
    const codeA = `
      function calculateSum(a: number, b: number): number {
        const total = a + b;
        return total;
      }
    `;

    const codeB = `function calculateSum(a:number,b:number):number{
\tconst total = a + b;
\treturn total;
}`;

    const hashA = FingerprintNormalizer.hashNormalizedText(codeA);
    const hashB = FingerprintNormalizer.hashNormalizedText(codeB);

    expect(hashA).toBe(hashB);
  });

  it('should ignore single-line, multi-line, and HTML/template comments', () => {
    const withComments = `
      // Hitung diskon pengguna
      function applyDiscount(price: number): number {
        /* Pengecekan batas minimum */
        <!-- template comment placeholder -->
        return price * 0.9;
      }
    `;

    const cleanCode = `
      function applyDiscount(price: number): number {
        return price * 0.9;
      }
    `;

    expect(FingerprintNormalizer.hashNormalizedText(withComments)).toBe(
      FingerprintNormalizer.hashNormalizedText(cleanCode)
    );
  });

  it('should normalize single and double quotes consistently', () => {
    const singleQuotes = `const greeting = 'hello world'; const target = 'production';`;
    const doubleQuotes = `const greeting = "hello world"; const target = "production";`;

    expect(FingerprintNormalizer.hashNormalizedText(singleQuotes)).toBe(
      FingerprintNormalizer.hashNormalizedText(doubleQuotes)
    );
  });

  it('should be immune to trailing commas and trailing semicolons', () => {
    const withTrailing = `
      const config = {
        host: "localhost",
        port: 8080,
        tags: ["api", "v1",],
      };
      function run(a, b,) {
        return [a, b,];
      };
    `;

    const withoutTrailing = `
      const config = {
        host: "localhost",
        port: 8080,
        tags: ["api", "v1"]
      }
      function run(a, b) {
        return [a, b]
      }
    `;

    expect(FingerprintNormalizer.hashNormalizedText(withTrailing)).toBe(
      FingerprintNormalizer.hashNormalizedText(withoutTrailing)
    );
  });

  it('should detect actual semantic changes and produce different fingerprints', () => {
    const original = `function add(a: number, b: number) { return a + b; }`;
    const modified = `function add(a: number, b: number) { return a - b; }`;
    const renamed = `function addNumbers(a: number, b: number) { return a + b; }`;

    const hashOrig = FingerprintNormalizer.hashNormalizedText(original);
    const hashMod = FingerprintNormalizer.hashNormalizedText(modified);
    const hashRenamed = FingerprintNormalizer.hashNormalizedText(renamed);

    expect(hashOrig).not.toBe(hashMod);
    expect(hashOrig).not.toBe(hashRenamed);
  });
});
