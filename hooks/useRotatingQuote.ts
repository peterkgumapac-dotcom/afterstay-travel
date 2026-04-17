import { useEffect, useState } from 'react';

import { getQuoteSet } from '../lib/quotes';

export const useRotatingQuote = (destination: string, intervalMs = 8000) => {
  const quotes = getQuoteSet(destination);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % quotes.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [quotes.length, intervalMs]);

  return quotes[index];
};
