// Prints, for every tab of a collection, TMDB's total and its top titles, using
// the filters exactly as written in the JSON. Needs TMDB_API_KEY (never printed).
// Usage: node Collections/tools/count.js [generi.json]
'use strict';

const path = require('path');

const KEY = process.env.TMDB_API_KEY;
if (!KEY) { console.error('TMDB_API_KEY is not set'); process.exit(1); }

const PARAMS = {
  withGenres: 'with_genres', withoutGenres: 'without_genres', withKeywords: 'with_keywords',
  withoutKeywords: 'without_keywords', voteCountGte: 'vote_count.gte', withNetworks: 'with_networks',
  releaseDateGte: 'date.gte', releaseDateLte: 'date.lte',
};

function query(s) {
  const tv = s.mediaType === 'TV';
  const p = new URLSearchParams({ api_key: KEY, language: 'it-IT', sort_by: s.sortBy });
  for (const [k, v] of Object.entries(s.filters || {})) {
    const name = PARAMS[k].replace('date', tv ? 'first_air_date' : 'primary_release_date');
    p.set(name, v);
  }
  if (s.tmdbSourceType === 'NETWORK') p.set('with_networks', s.tmdbId);
  return fetch(`https://api.themoviedb.org/3/discover/${tv ? 'tv' : 'movie'}?${p}`).then(r => r.json());
}

const file = path.resolve(__dirname, '..', process.argv[2] || 'generi.json');
const folders = [].concat(...require(file).map(c => c.folders));
(async () => {
  for (const f of folders) {
    for (const s of f.sources) {
      const d = await query(s);
      const top = (d.results || []).slice(0, 5).map(r => r.title || r.name).join(', ');
      console.log(`${f.title} | ${s.title} | ${d.total_results} | ${top}`);
    }
  }
})();
