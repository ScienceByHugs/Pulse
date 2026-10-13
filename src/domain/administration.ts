export function administrationLabel(route: string | null | undefined): string {
  switch (route) {
    case 'subcutaneous': return 'Subcutaneous injection';
    case 'intramuscular': return 'Intramuscular injection';
    case 'oral': return 'Oral';
    case 'topical': return 'Topical';
    case 'other': return 'Other';
    default: return 'Not specified';
  }
}
