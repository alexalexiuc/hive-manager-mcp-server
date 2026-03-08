import { z } from 'zod';

const YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: string): boolean {
  const [yearPart, monthPart, dayPart] = value.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export const isoTimestampSchema = z.string().datetime({ offset: true });

export const yyyyMmDdDateSchema = z
  .string()
  .regex(YYYY_MM_DD_REGEX, 'Expected date in YYYY-MM-DD format.')
  .refine(isValidDateOnly, 'Invalid calendar date.');
