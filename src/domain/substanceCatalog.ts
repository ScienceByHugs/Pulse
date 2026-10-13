// Names are lookup conveniences, not recommendations or approved-product claims.
export const substanceCatalog = [
  { name: 'BPC-157', category: 'Peptide' },
  { name: 'CJC-1295', category: 'Peptide' },
  { name: 'GHK-Cu', category: 'Peptide' },
  { name: 'Ipamorelin', category: 'Peptide' },
  { name: 'MOTS-C', category: 'Peptide' },
  { name: 'Retatrutide', category: 'GLP-1' },
  { name: 'Semaglutide', category: 'GLP-1' },
  { name: 'Sermorelin', category: 'Peptide' },
  { name: 'TB-500', category: 'Peptide' },
  { name: 'Tesamorelin', category: 'Peptide' },
  { name: 'Testosterone Cypionate', category: 'Anabolic' },
  { name: 'Testosterone Enanthate', category: 'Anabolic' },
  { name: 'Tirzepatide', category: 'GLP-1' },
] as const;
export function matchingSubstances(query: string) {
  const term = query.trim().toLowerCase();
  return substanceCatalog.filter(entry => entry.name.toLowerCase().includes(term));
}
