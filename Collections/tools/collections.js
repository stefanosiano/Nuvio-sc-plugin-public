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
// "!JP": every TMDB country but JP, since Nuvio has no without-country filter
const COUNTRIES = load('countries.json');
const origin = c => /^!/.test(c) ? COUNTRIES.filter(x => x !== c.slice(1)).join('|') : c;
const collection = (id, title, folders) => [{
  id, title, focusGlowEnabled: true, viewMode: 'TABBED_GRID', showAllTab: false, folders,
}];
const write = (file, data) => {
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(data, null, 2));
  console.log(file, '-', data.map(c => c.folders.length).join(' + '), 'folders');
};

// Two collections, the second titled "-" (Nuvio's import rejects a blank title).
function originali() {
  const brands = load('brands.json');
  const folders = row => brands.filter(b => (b.row || 1) === row).map(b => {
    const base = { title: 'Popolari', mediaType: 'TV', sortBy: 'popularity.desc' };
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
      sources: [recent, source],
    };
  });
  return collection('italian-streaming-originals', 'Serie Originali', folders(1))
    .concat(collection('italian-streaming-originals-2', '-', folders(2)));
}

function decenni() {
  // Film and Serie TV leave out Japanese titles, which get their own Anime tabs
  const source = (mediaType, d, anime) => {
    const votes = anime ? d.animeVotes[mediaType] : VOTES[mediaType]; // anime get far fewer votes
    const filters = { releaseDateGte: d.gte, releaseDateLte: d.lte, voteCountGte: votes };
    if (mediaType === 'TV') filters.withoutGenres = '10763,10764,10767'; // no news/reality/talk
    Object.assign(filters, anime ? { withGenres: '16', withOriginCountry: 'JP' } : { withOriginCountry: origin('!JP') });
    for (const k of Object.keys(filters)) if (filters[k] == null) delete filters[k];
    const title = anime ? (mediaType === 'MOVIE' ? 'Film Anime' : 'Serie Anime') : (mediaType === 'MOVIE' ? 'Film' : 'Serie TV');
    return { provider: 'tmdb', tmdbSourceType: 'DISCOVER', mediaType, sortBy: 'popularity.desc', title, filters };
  };
  return collection('decades', 'Decenni', load('decades.json').map(d => ({
    id: 'decade-' + d.slug, title: d.title,
    coverImageUrl: `${BASE}/covers/decade-${d.slug}.png`,
    tileShape: 'SQUARE', hideTitle: true,
    sources: [source('MOVIE', d), source('TV', d), source('TV', d, true), source('MOVIE', d, true)],
  })));
}

function generi() {
  const source = ([mediaType, title, f], sortBy = 'popularity.desc') => {
    const filters = Object.assign({ voteCountGte: VOTES[mediaType] }, f); // a tab may set its own minimum
    if (f.withOriginCountry) filters.withOriginCountry = origin(f.withOriginCountry);
    if (mediaType === 'TV') filters.withoutGenres = [NEWS_TALK, f.withoutGenres].filter(Boolean).join(',');
    return { provider: 'tmdb', tmdbSourceType: 'DISCOVER', mediaType, sortBy, title, filters };
  };
  const RECENT = { MOVIE: 'primary_release_date.desc', TV: 'first_air_date.desc' };
  const folder = (g, mediaType, sources) => ({
    id: `genre-${mediaType.toLowerCase()}-${g.slug}`, title: g.title,
    coverImageUrl: `${BASE}/covers/genre-${mediaType.toLowerCase()}-${g.slug}.png`,
    tileShape: 'LANDSCAPE', hideTitle: true, sources,
  });
  const genres = load('genres.json');
  const folders = mediaType => genres.map(g => {
    const tabs = g.sources.filter(s => s[0] === mediaType).map(s => source(s, s[3])); // s[3]: optional sortBy
    if (!(g.recent || {})[mediaType]) return folder(g, mediaType, tabs); // its tabs bring their own Recenti
    const recent = source([mediaType, 'Recenti', g.recent[mediaType]], RECENT[mediaType]);
    return folder(g, mediaType, (g.recentFirst || []).includes(mediaType) ? [recent].concat(tabs) : tabs.concat(recent));
  });
  return collection('genres-tv', 'Serie per generi', folders('TV'))
    .concat(collection('genres-movie', 'Film per generi', folders('MOVIE')));
}

write('serie-originali.json', originali());
write('decenni.json', decenni());
write('generi.json', generi());
