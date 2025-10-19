/**
 * Format a date as relative time (e.g., "2 days ago", "just now", "in 3 hours")
 */
export function formatRelativeDate(date: Date | string): string {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  
  const diffMs = now.getTime() - targetDate.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  // Future dates
  if (diffMs < 0) {
    const absDiffMin = Math.abs(diffMin);
    const absDiffHour = Math.abs(diffHour);
    const absDiffDay = Math.abs(diffDay);
    
    if (absDiffMin < 1) return "in a moment";
    if (absDiffMin < 60) return `in ${absDiffMin} min`;
    if (absDiffHour < 24) return `in ${absDiffHour} hour${absDiffHour > 1 ? 's' : ''}`;
    if (absDiffDay < 7) return `in ${absDiffDay} day${absDiffDay > 1 ? 's' : ''}`;
    return targetDate.toLocaleDateString('tr-TR');
  }

  // Past dates
  if (diffSec < 10) return "just now";
  if (diffMin < 1) return `${diffSec} sec ago`;
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  if (diffWeek < 4) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
}

/**
 * Format a date with both absolute and relative time
 * Returns an object with full date and relative time
 */
export function formatDateWithRelative(date: Date | string) {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  
  return {
    absolute: targetDate.toLocaleDateString('tr-TR', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    }),
    relative: formatRelativeDate(targetDate),
    full: targetDate.toLocaleString('tr-TR'),
  };
}
