import { format, parseISO } from 'date-fns';

/**
 * Formats a date string to a human-readable format
 * @param dateString - ISO date string to format
 * @param formatString - Optional format string, defaults to 'MMM d, yyyy'
 * @returns Formatted date string or empty string if date is invalid
 */
export const formatDate = (dateString?: string, formatString: string = 'MMM d, yyyy'): string => {
  if (!dateString) return '';
  
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}; 