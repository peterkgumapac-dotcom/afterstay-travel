export type QuoteSet = {
  keywords: string[];
  quotes: string[];
};

export const QUOTE_SETS: QuoteSet[] = [
  {
    keywords: ['beach', 'island', 'boracay', 'bali', 'maldives', 'phuket', 'coast', 'tropical'],
    quotes: [
      'Sunsets and saltwater therapy ahead',
      'Paradise is just a breath away',
      'Your beach is waiting',
      'Ocean in the air, sand in your hair',
      'Waves are calling, you\'re answering',
      'Barefoot days, endless horizons',
      'The sea never asks, it just welcomes',
      'White sand, blue water, zero worries',
    ],
  },
  {
    keywords: ['ski', 'alps', 'mountain', 'snow', 'winter', 'niseko'],
    quotes: [
      'Fresh powder awaits',
      'The mountains are calling',
      'Cold air, warm souls',
      'Snow days and slope views',
      'Winter magic is coming',
    ],
  },
  {
    keywords: ['japan', 'tokyo', 'kyoto', 'seoul', 'korea', 'taipei'],
    quotes: [
      'Cherry blossoms and new stories',
      'Neon nights and quiet mornings',
      'Ramen, temples, and everything between',
      'East meets wonder',
      'Your Japan chapter begins soon',
    ],
  },
  {
    keywords: ['paris', 'rome', 'europe', 'italy', 'france', 'barcelona'],
    quotes: [
      'Cobblestones and cappuccinos',
      'Old cities, new memories',
      'La dolce vita awaits',
      'Europe whispers your name',
    ],
  },
  {
    keywords: [],
    quotes: [
      'Adventure is just around the corner',
      'Your journey begins soon',
      'New places, new stories',
      'The world is waiting',
      'Pack light, dream big',
    ],
  },
];

export const getQuoteSet = (destination: string): string[] => {
  const lower = (destination || '').toLowerCase();
  for (const set of QUOTE_SETS) {
    if (set.keywords.some((kw) => lower.includes(kw))) return set.quotes;
  }
  return QUOTE_SETS[QUOTE_SETS.length - 1].quotes;
};
