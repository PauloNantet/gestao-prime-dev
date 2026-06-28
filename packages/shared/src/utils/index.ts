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

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

export const calculateEndDate = (
  startDate: Date,
  validityDays: number,
): Date => {
  const date = new Date(startDate);
  date.setDate(date.getDate() + validityDays);
  return date;
};
