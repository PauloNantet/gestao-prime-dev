export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const generateDatabaseName = (slug: string): string =>
  `tenant_${slug.replace(/-/g, '_')}`;

export const calculateEndDate = (
  startDate: Date,
  interval: string,
  intervalCount: number
): Date => {
  const date = new Date(startDate);
  const intervals: Record<string, (d: Date, n: number) => void> = {
    monthly: (d, n) => d.setMonth(d.getMonth() + n),
    quarterly: (d, n) => d.setMonth(d.getMonth() + n * 3),
    semestral: (d, n) => d.setMonth(d.getMonth() + n * 6),
    yearly: (d, n) => d.setFullYear(d.getFullYear() + n),
  };
  intervals[interval]?.(date, intervalCount);
  return date;
};
