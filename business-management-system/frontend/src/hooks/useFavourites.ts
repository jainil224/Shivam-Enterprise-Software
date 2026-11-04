import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY_FAVOURITES = 'bms_user_favourites';

const DEFAULT_FAVOURITES = [
  'sales',
  'delivery_challan',
  'purchase',
  'bank_receipt',
  'outstanding',
];

export const useFavourites = () => {
  const [favourites, setFavourites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FAVOURITES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_FAVOURITES;
  });

  // Save to localStorage whenever state updates
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FAVOURITES, JSON.stringify(favourites));
    } catch (e) {
      console.warn('Could not persist favourites to localStorage', e);
    }
  }, [favourites]);

  const isFavourite = useCallback(
    (id: string): boolean => favourites.includes(id),
    [favourites]
  );

  const toggleFavourite = useCallback((id: string) => {
    setFavourites((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const addFavourite = useCallback((id: string) => {
    setFavourites((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeFavourite = useCallback((id: string) => {
    setFavourites((prev) => prev.filter((item) => item !== id));
  }, []);

  return {
    favourites,
    isFavourite,
    toggleFavourite,
    addFavourite,
    removeFavourite,
  };
};

