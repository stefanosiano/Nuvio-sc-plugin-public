// Writes the Nuvio collection JSONs (serie-originali, decenni, generi) from the
// data files next to this script. Usage: node Collections/tools/collections.js
'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..');
const BASE = 'https://raw.githubusercontent.com/stefanosiano/Nuvio-sc-plugin-public/main/Collections';
const NEWS_TALK = '10763,10767'; // never in series sources
const VOTES = { MOVIE: 100, TV: 25 };

const load = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const collection = (id, title, folders) => [{
  id, title, pinToTop: false, focusGlowEnabled: true, viewMode: 'TABBED_GRID', showAllTab: false, folders,
}];
const write = (file, data) => {
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(data, null, 2));
  console.log(file, '-', data.map(c => c.folders.length).join(' + '), 'folders');
};

// Two collections, the second titled "-" (Nuvio's import rejects a blank title).
function originali() {
  const brands = load('brands.json');
  const folders = row => brands.filter(b => (b.row || 1) === row).map(b => {
    const base = { title: b.sourceTitle || b.title + ' Originals', mediaType: 'TV', sortBy: 'popularity.desc' };
    const source = b.network
      ? Object.assign({ provider: 'tmdb', tmdbSourceType: 'NETWORK' }, base, { filters: {}, tmdbId: b.network })
      : Object.assign({ provider: 'tmdb', tmdbSourceType: 'DISCOVER' }, base, { filters: b.filters });
    const recentFilters = Object.assign({}, source.filters, b.recentVotes ? { voteCountGte: b.recentVotes } : {});
    const recent = Object.assign({}, source, { title: 'Recenti', sortBy: 'first_air_date.desc', filters: recentFilters });
    return {
      id: 'orig-' + b.slug, title: b.title,
      coverImageUrl: `${BASE}/covers/${b.slug}.png`,
      titleLogoUrl: `${BASE}/logos/${b.slug}.png`,
      tileShape: 'LANDSCAPE', hideTitle: true,
      sources: [source, recent],
    };
  });
  return collection('italian-streaming-originals', 'Serie Originali', folders(1))
    .concat(collection('italian-streaming-originals-2', '-', folders(2)));
}

function decenni() {
  const source = (mediaType, d) => {
    const filters = { releaseDateGte: d.gte, releaseDateLte: d.lte, voteCountGte: VOTES[mediaType] };
    if (mediaType === 'TV') filters.withoutGenres = '10763,10764,10767'; // no news/reality/talk
    for (const k of Object.keys(filters)) if (filters[k] == null) delete filters[k];
    return {
      provider: 'tmdb', tmdbSourceType: 'DISCOVER', mediaType, sortBy: 'popularity.desc',
      title: mediaType === 'MOVIE' ? 'Film' : 'Serie TV', filters,
    };
  };
  return collection('decades', 'Decenni', load('decades.json').map(d => ({
    id: 'decade-' + d.slug, title: d.title,
    coverImageUrl: `${BASE}/covers/decade-${d.slug}.png`,
    tileShape: 'SQUARE', hideTitle: true,
    sources: [source('MOVIE', d), source('TV', d)],
  })));
}

function generi() {
  const source = ([mediaType, title, f], sortBy = 'popularity.desc') => {
    const filters = Object.assign({ voteCountGte: VOTES[mediaType] }, f); // a tab may set its own minimum
    if (mediaType === 'TV') filters.withoutGenres = [NEWS_TALK, f.withoutGenres].filter(Boolean).join(',');
    return { provider: 'tmdb', tmdbSourceType: 'DISCOVER', mediaType, sortBy, title, filters };
  };
  const RECENT = { MOVIE: 'primary_release_date.desc', TV: 'first_air_date.desc' };
  const genres = load('genres.json');
  const folders = mediaType => genres.map(g => ({
    id: `genre-${mediaType.toLowerCase()}-${g.slug}`, title: g.title,
    coverImageUrl: `${BASE}/covers/genre-${mediaType.toLowerCase()}-${g.slug}.png`,
    tileShape: 'LANDSCAPE', hideTitle: true,
    sources: g.sources.filter(s => s[0] === mediaType).map(s => source(s, s[3])) // s[3]: optional sortBy
      .concat(source([mediaType, 'Recenti', g.recent[mediaType]], RECENT[mediaType])),
  }));
  return collection('genres-tv', 'Serie per generi', folders('TV'))
    .concat(collection('genres-movie', 'Film per generi', folders('MOVIE')));
}

write('serie-originali.json', originali());
write('decenni.json', decenni());
write('generi.json', generi());
