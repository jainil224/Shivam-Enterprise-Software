import { useModulePreferences } from './useModulePreferences';

/**
 * @deprecated Use `useModulePreferences` directly.
 *
 * Kept as a thin compatibility shim for older imports. It now reads the shared
 * pin store instead of owning a private `useState`, so every consumer stays in
 * sync the moment a module is pinned or unpinned.
 */
export const useFavourites = () => {
  const { pins, isPinned, togglePin, pin, unpin } = useModulePreferences();

  return {
    favourites: pins,
    isFavourite: isPinned,
    toggleFavourite: togglePin,
    addFavourite: pin,
    removeFavourite: unpin,
  };
};