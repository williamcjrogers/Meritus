const questionStopWords = new Set(
  "a about an and any are as at be been being both by can could do does find for from give had has have how i in into is it its list look me most my of on or our please research say should show some tell than that the their them there these they this those to us was we were what when where which who why will with would you your companies company information latest recent".split(" "),
);

export function quickSearchTerms(question: string): string[] {
  return [...new Set((question.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter(term => term.length > 1 && !questionStopWords.has(term)))].slice(0, 24);
}

function singular(term: string): string {
  if (["news", "series", "species"].includes(term)) return term;
  if (term.length > 4 && term.endsWith("ies")) return term.slice(0, -3) + "y";
  if (/(ches|shes|sses|xes|zes)$/.test(term)) return term.slice(0, -2);
  if (term.length > 3 && term.endsWith("s") && !/(ss|us|is)$/.test(term)) return term.slice(0, -1);
  return term;
}

/** Both stored-corpus retrieval and excerpt selection use the same payment vocabulary. */
export function expandedQuickSearchTerms(question: string): string[] {
  const original = quickSearchTerms(question);
  const terms = [...new Set([...original, ...original.map(singular)])];
  const payment = ["payment", "pay", "paid", "unpaid", "invoice"];
  return [...new Set(terms.some(term => payment.includes(term)) ? [...terms, ...payment] : terms)];
}

function inflections(term: string): string[] {
  if (!/^[a-z]+$/.test(term) || term.length < 3) return [term];
  const roots = new Set([singular(term)]);
  if (term.length > 5 && term.endsWith("ing")) {
    const root = term.slice(0, -3);
    roots.add(root);
    roots.add(root + "e");
    if (/([b-df-hj-np-tv-z])\1$/.test(root)) roots.add(root.slice(0, -1));
  }
  if (term.length > 4 && term.endsWith("ied")) roots.add(term.slice(0, -3) + "y");
  else if (term.length > 4 && term.endsWith("ed")) {
    const root = term.slice(0, -2);
    roots.add(root);
    roots.add(root + "e");
    if (/([b-df-hj-np-tv-z])\1$/.test(root)) roots.add(root.slice(0, -1));
  }
  const forms = new Set([term]);
  for (const root of roots) {
    forms.add(root);
    forms.add(root + "s");
    forms.add(root + "es");
    forms.add(root + "ed");
    forms.add(root + "ing");
    if (root.endsWith("e")) {
      forms.add(root + "d");
      forms.add(root.slice(0, -1) + "ing");
    }
    if (/[^aeiou]y$/.test(root)) {
      forms.add(root.slice(0, -1) + "ies");
      forms.add(root.slice(0, -1) + "ied");
    }
    if (/[aeiou][b-df-hj-np-tv-z]$/.test(root)) {
      forms.add(root + root.at(-1) + "ed");
      forms.add(root + root.at(-1) + "ing");
    }
  }
  return [...forms];
}

/** Match common English inflections which PostgreSQL's English search also folds. */
export function quickExcerptPatterns(question: string): RegExp[] {
  return expandedQuickSearchTerms(question).map(term => new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${inflections(term).join("|")})(?![\\p{L}\\p{N}])`, "giu",
  ));
}
