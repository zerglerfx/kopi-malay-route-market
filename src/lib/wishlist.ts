/** Union of guest and account wishlist product ids, account order first, no duplicates. */
export function mergeWishlist(account: string[], guest: string[]): string[] {
  return [...new Set([...account, ...guest])];
}

export function toggleWishlist(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}
