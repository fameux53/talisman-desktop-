import { STARTER_PRODUCTS } from '../data/starterCatalog';

export interface ParsedProduct {
  name: string;
  price: number | null;
  unit: string;
  emoji: string | null;
}

/** Build a lookup of catalog names → emoji for fuzzy matching */
const catalogLookup = new Map<string, string>();
for (const p of STARTER_PRODUCTS) {
  catalogLookup.set(p.nameHT.toLowerCase(), p.emoji);
  catalogLookup.set(p.nameFR.toLowerCase(), p.emoji);
  catalogLookup.set(p.nameEN.toLowerCase(), p.emoji);
}

function findCatalogEmoji(name: string): string | null {
  const lower = name.toLowerCase();
  // Exact match
  if (catalogLookup.has(lower)) return catalogLookup.get(lower)!;
  // Fuzzy: check if catalog name is contained in the input or vice versa
  for (const [catalogName, emoji] of catalogLookup) {
    if (lower.includes(catalogName) || catalogName.includes(lower)) return emoji;
  }
  return null;
}

export function guessUnit(name: string): string {
  const lower = name.toLowerCase();
  // Grains & legumes sold by mamit
  if (/diri|mayi moulen|pwa|farin|s[eè]l\b|sik\b|pitimi|lantiy|riz|ma[ïi]s moulu|haricot|lentil|farine|sel\b|sucre|rice|corn\s?meal|bean|flour|salt|sugar|millet/.test(lower)) return 'mamit';
  // Liquids & bottled goods
  if (/lwil|ji\b|kola|dlo\b|klowòks|akasan|kremas|kleren|ronm|mabi|vinèg|chanpou|huile|jus|soda|eau\b|javel|oil|juice|water|bleach|caf[eé]|coffee|rhum|shampoo/.test(lower)) return 'boutèy';
  // Items sold by dozen
  if (/sitron|ze\b|zoranj|citron|lime|oeufs|eggs|orange|dozen|douzèn/.test(lower)) return 'douzèn';
  // Items sold by rejim (bunches)
  if (/bannann|banane|plantain/.test(lower)) return 'rejim';
  // Meats, fish, produce sold by weight (liv)
  if (/vyann|pwason|patat|tomat|zonyon|piman|kawòt|kalalou|malanga|yanm|manyòk|saindou|arans[oò]|viande|poisson|patate|tomate|oignon|piment|carotte|beef|pork|goat|fish|potato|tomato|onion|pepper|crab|conch/.test(lower)) return 'liv';
  // Charcoal and heavy goods by sak
  if (/chabon|farin|charbon|charcoal/.test(lower)) return 'sak';
  // Packets
  if (/biskwit|chips|epina|lalo|kreson|pèsi|sèlri|bonbon|detèjan|pakèt|biscuit|cracker|cookie|chip/.test(lower)) return 'pakèt';
  // Cans
  if (/lèt konbine|tòmat pàs|bwat|can|paste/.test(lower)) return 'bwat';
  return 'pyès';
}

export function parseProductList(text: string): ParsedProduct[] {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  return lines
    .map((line) => {
      const trimmed = line.trim();

      // Try pattern: "Product name: 250" or "Product name - 250" or "Product name  250"
      // Match a number at the end, optionally preceded by : ; - tab or multiple spaces
      const priceMatch = trimmed.match(
        /^(.+?)[\s:;\-\t]+(\d+(?:\.\d+)?)\s*(?:G|g|HTG|goud(?:es)?|gourdes?)?\s*$/
      );

      if (priceMatch) {
        const name = priceMatch[1].trim();
        if (!name) return null;
        return {
          name,
          price: parseFloat(priceMatch[2]),
          unit: guessUnit(name),
          emoji: findCatalogEmoji(name),
        };
      }

      // No price found — just a product name
      if (!trimmed) return null;
      return {
        name: trimmed,
        price: null,
        unit: guessUnit(trimmed),
        emoji: findCatalogEmoji(trimmed),
      };
    })
    .filter((p): p is ParsedProduct => p !== null && p.name.length > 0);
}
