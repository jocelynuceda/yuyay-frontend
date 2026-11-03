const MAX_COLLECTION_PAGES = 1000;

export interface Page<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// Existing screens calculate category and unread counters from the complete collection.
export async function collectPages<T>(fetchPage: (number: number) => Promise<Page<T> | T[]>): Promise<T[]> {
  const items: T[] = [];
  let number = 0;
  let totalPages = 1;
  while (number < totalPages) {
    const page = await fetchPage(number);
    if (Array.isArray(page)) {
      if (number !== 0) throw new Error('La API cambió de contrato durante la carga. Actualiza la colección.');
      return page;
    }
    const validSize = Number.isInteger(page.size) && page.size > 0 && page.size <= 100;
    const validTotal = Number.isSafeInteger(page.totalElements) && page.totalElements >= 0;
    if (!Array.isArray(page.content) || page.number !== number || !validSize || !validTotal
        || !Number.isInteger(page.totalPages) || page.totalPages < 0
        || page.totalPages > MAX_COLLECTION_PAGES
        || page.totalPages !== Math.ceil(page.totalElements / page.size)
        || page.content.length > page.size
        || (page.totalPages > number && page.content.length === 0)
        || (number > 0 && page.totalPages !== totalPages)) {
      throw new Error('No pudimos cargar la colección completa. Actualiza o limita los resultados.');
    }
    items.push(...page.content);
    totalPages = page.totalPages;
    number += 1;
  }
  return items;
}
