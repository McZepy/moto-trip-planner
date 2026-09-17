import fs from 'node:fs/promises'

const APP_PATH = new URL('../src/App.tsx', import.meta.url)
let source = await fs.readFile(APP_PATH, 'utf8')

if (source.includes("from './providers/autocompleteRanking'")) {
  console.log('Ranking autocomplete già integrato')
  process.exit(0)
}

function replaceOnce(label, search, replacement) {
  const first = source.indexOf(search)
  if (first < 0) throw new Error(`Patch ${label}: blocco non trovato`)
  const second = source.indexOf(search, first + search.length)
  if (second >= 0) throw new Error(`Patch ${label}: blocco non univoco`)
  source = source.slice(0, first) + replacement + source.slice(first + search.length)
}

replaceOnce(
  'import-ranking',
  `} from './providers/autocompleteProvider'\n\nimport {\n  isAreaResult,`,
  `} from './providers/autocompleteProvider'\nimport {\n  rankAutocompleteSuggestions,\n} from './providers/autocompleteRanking'\n\nimport {\n  isAreaResult,`,
)

replaceOnce(
  'start-results',
  `        setStartResults(\n          results,\n        )`,
  `        setStartResults(\n          rankAutocompleteSuggestions(\n            cleanQuery,\n            results,\n          ),\n        )`,
)

replaceOnce(
  'destination-results',
  `        setDestinationResults(\n          results,\n        )`,
  `        setDestinationResults(\n          rankAutocompleteSuggestions(\n            cleanQuery,\n            results,\n          ),\n        )`,
)

replaceOnce(
  'intermediate-results',
  `                  results,\n                }`,
  `                  results:\n                    rankAutocompleteSuggestions(\n                      cleanQuery,\n                      results,\n                    ),\n                }`,
)

await fs.writeFile(APP_PATH, source)
console.log('Ranking autocomplete integrato in App.tsx')
