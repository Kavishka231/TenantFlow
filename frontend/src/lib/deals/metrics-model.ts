export function calculateConversionRate(won: number, lost: number) {
  const closed = won + lost;
  return closed ? Math.round(won / closed * 1000) / 10 : 0;
}
