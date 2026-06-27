/**
 * Returns the current date (or a specific date) formatted as 'YYYY-MM-DD'
 * in the America/Sao_Paulo timezone to ensure timezone consistency
 * between the client and server.
 */
export function getSaoPauloDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Calculates the number of days between today (in America/Sao_Paulo timezone)
 * and a given target date string (format YYYY-MM-DD).
 * Returns Infinity if dateString is empty/undefined.
 */
export function getDaysUntil(dateString?: string): number {
  if (!dateString) return Infinity;
  try {
    const todayStr = getSaoPauloDateString();
    const today = new Date(todayStr);
    const target = new Date(dateString);
    
    // Compare timestamps directly since both new Date("YYYY-MM-DD") parse as UTC midnight
    const diffTime = target.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  } catch (error) {
    console.error("Erro ao calcular dias até expiração:", error);
    return Infinity;
  }
}

