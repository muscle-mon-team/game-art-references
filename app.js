const $ = (id) => document.getElementById(id);
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize = (value) => String(value).toLocaleLowerCase().normalize('NFKD').replace(/[\p{P}\p{S}\s]/gu, '');
const storageKey = 'muscle-mon-art-reference-board-v1';
const PAGE_SIZE = 48;
let catalog, gamesById, shotsById;
let board = { version: 1, favorites: [], notes: {} };
let state = { dimension: '', style: '', query: '', side: false, library: 'all', view: 'games', sort: 'curated', limit: PAGE_SIZE, game: '', compare: [] };
let lightboxGame = '', lightboxIndex = 0, toastTimer;
let storageAvailable = true;

function notify(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
}

function readBoard() {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (raw) board = validateBoard(raw);
  } catch { storageAvailable = false; }
}

function validateBoard(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.favorites) || typeof raw.notes !== 'object' || !raw.notes || Array.isArray(raw.notes)) {
    throw new Error('이 갤러리에서 내보낸 선택 파일을 사용해주세요.');
  }
  if (!raw.favorites.every((id) => typeof id === 'string') || !Object.values(raw.notes).every((note) => typeof note === 'string' && note.length <= 2000)) {
    throw new Error('선택 파일의 형식을 확인해주세요.');
  }
  return {
    version: 1,
    favorites: [...new Set(raw.favorites.filter((id) => shotsById.has(id)))],
    notes: Object.fromEntries(Object.entries(raw.notes).filter(([id, text]) => shotsById.has(id) && text.trim())),
  };
}

function persistBoard() {
  if (!storageAvailable) return false;
  try { localStorage.setItem(storageKey, JSON.stringify(board)); return true; }
  catch { storageAvailable = false; notify('브라우저 저장이 제한되어 있어요. 내 선택 내보내기로 보관해주세요.'); return false; }
}

function isFavorite(id) { return board.favorites.includes(id); }
function isCompared(id) { return state.compare.includes(id); }
function gameShots(game) { return state.library === 'favorites' ? game.screenshots.filter((shot) => isFavorite(shot.id)) : game.screenshots; }

function matchingGames() {
  const terms = state.query.trim().split(/\s+/).map(normalize).filter(Boolean);
  let list = catalog.games.filter((game) => {
    if (state.game && game.id !== state.game) return false;
    if (state.dimension && game.dimension !== state.dimension) return false;
    if (state.style && !game.tags.includes(state.style)) return false;
    if (state.side && !['횡스크롤', '깊이 있는 측면', '벨트스크롤'].includes(game.camera)) return false;
    if (state.library === 'favorites' && !gameShots(game).length) return false;
    return terms.every((term) => game.searchIndex.includes(term));
  });
  list = [...list].sort((a, b) => {
    if (state.sort === 'name') return a.title.localeCompare(b.title);
    if (state.sort === 'count') return gameShots(b).length - gameShots(a).length || a.catalogOrder - b.catalogOrder;
    return Number(b.featured) - Number(a.featured) || a.catalogOrder - b.catalogOrder;
  });
  return list;
}

function interleave(list) {
  const result = [];
  const collections = list.map((game) => ({ game, shots: gameShots(game) }));
  const maximum = Math.max(0, ...collections.map(({ shots }) => shots.length));
  for (let index = 0; index < maximum; index++) {
    for (const { game, shots } of collections) if (shots[index]) result.push({ game, shot: shots[index] });
  }
  return result;
}

function badge(game) { return `<span class="dimension-badge" data-dimension="${game.dimension}">${game.dimension}</span>`; }
function imageHTML(shot, game, index = 0) {
  return `<img src="${escapeHTML(shot.thumbnail)}" alt="${escapeHTML(game.title)} 공식 스크린샷 ${index + 1}" loading="lazy" decoding="async" width="600" height="338">`;
}
function gameCard(game) {
  const shots = gameShots(game);
  return `<article class="game-card">
    <div class="card-image"><button class="image-button" data-action="game" data-id="${game.id}" aria-label="${escapeHTML(game.title)} 스크린샷 ${shots.length}장 보기">${imageHTML(shots[0], game, game.screenshots.findIndex((shot) => shot.id === shots[0].id))}</button>${game.featured ? '<span class="featured-label">먼저 둘러보기</span>' : ''}<span class="shot-count">${shots.length}장</span></div>
    <div class="card-body"><div class="card-topline"><button class="card-title" data-action="game" data-id="${game.id}">${escapeHTML(game.title)}</button>${badge(game)}</div>
    <div class="card-subtitle">${escapeHTML(game.searchTerms)} <span aria-hidden="true">/</span> ${escapeHTML(game.camera)}</div>
    <div class="card-tags">${game.tags.slice(0, 4).map((tag) => `<span>${escapeHTML(tag)}</span>`).join('')}</div>
    <div class="card-bottom"><a href="${escapeHTML(game.source)}" target="_blank" rel="noopener noreferrer">공식 출처 보기</a><span>${escapeHTML(game.sourceLabel)}</span></div></div>
  </article>`;
}
function shotCard({ game, shot }) {
  const index = game.screenshots.findIndex((item) => item.id === shot.id);
  return `<article class="shot-card"><div class="card-image"><button class="image-button" data-action="shot" data-id="${shot.id}" aria-label="${escapeHTML(game.title)} 스크린샷 ${index + 1} 확대">${imageHTML(shot, game, index)}</button>
    <div class="shot-controls"><button class="shot-icon compare-symbol ${isCompared(shot.id) ? 'selected' : ''}" data-action="select-compare" data-id="${shot.id}" aria-label="비교 ${isCompared(shot.id) ? '해제' : '추가'}" aria-pressed="${isCompared(shot.id)}">▥</button><button class="shot-icon favorite-button ${isFavorite(shot.id) ? 'selected' : ''}" data-action="favorite" data-id="${shot.id}" aria-label="즐겨찾기 ${isFavorite(shot.id) ? '해제' : '추가'}" aria-pressed="${isFavorite(shot.id)}">${isFavorite(shot.id) ? '♥' : '♡'}</button></div><span class="shot-count">${index + 1} / ${game.screenshots.length}</span></div>
    <div class="card-body"><div class="card-topline"><button class="card-title" data-action="game" data-id="${game.id}">${escapeHTML(game.title)}</button>${badge(game)}</div><div class="card-subtitle">${escapeHTML(game.tags.slice(0, 3).join(' / '))}${board.notes[shot.id] ? ' / 메모 있음' : ''}</div></div></article>`;
}

function renderNavigation() {
  document.querySelector('.library-nav').dataset.library = state.library;
  $('nav-total').textContent = catalog.games.length;
  $('nav-favorites').textContent = board.favorites.length;
  document.querySelectorAll('[data-action="library"]').forEach((button) => {
    const active = button.dataset.value === state.library;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  $('dimension-nav').innerHTML = [['', '모든 차원', 'all'], ['2D', '2D', '2D'], ['2.5D', '2.5D', '2½'], ['3D', '3D', '3D']].map(([value, label, icon]) => {
    const count = catalog.games.filter((game) => !value || game.dimension === value).length;
    return `<button class="dimension-button ${state.dimension === value ? 'active' : ''}" data-action="dimension" data-value="${value}" aria-pressed="${state.dimension === value}"><span class="dimension-icon" aria-hidden="true">${icon}</span>${label}<span class="dimension-count">${count}</span></button>`;
  }).join('');
  $('style-filters').innerHTML = ['', ...catalog.styleTags].map((tag) => `<button class="style-chip ${state.style === tag ? 'active' : ''}" data-action="style" data-value="${escapeHTML(tag)}" aria-pressed="${state.style === tag}">${tag || '전체'}</button>`).join('');
  document.querySelectorAll('[data-action="view"]').forEach((button) => {
    const active = button.dataset.value === (state.game ? 'screenshots' : state.view);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  const filterNames = [state.dimension, state.style, state.side ? '측면 시점' : '', state.query ? `“${state.query}”` : ''].filter(Boolean);
  $('active-filter-label').textContent = filterNames.length ? filterNames.join(' / ') : '모든 스타일을 보고 있어요';
  $('reset-filters').hidden = !filterNames.length;
  $('search').value = state.query;
  $('side-only').checked = state.side;
  $('sort').value = state.sort;
  $('breadcrumb-current').textContent = state.game ? gamesById.get(state.game).title : state.library === 'favorites' ? '내가 고른 장면' : '모든 레퍼런스';
  $('page-title').textContent = state.library === 'favorites' ? '마음이 간 장면들' : '어떤 세계를 만들까?';
  $('page-description').textContent = state.library === 'favorites' ? '좋아하는 장면을 나란히 놓으면, 취향이 조금 더 선명해져요.' : '색, 질감, 캐릭터. 마음이 가는 장면을 모아보세요.';
}

function render() {
  if (!catalog) return;
  renderNavigation();
  const list = matchingGames();
  const shotCount = list.reduce((sum, game) => sum + gameShots(game).length, 0);
  const screenshotView = state.game || state.view === 'screenshots';
  const items = screenshotView ? interleave(list) : list;
  const rendered = items.slice(0, state.limit);
  $('gallery').innerHTML = rendered.map(screenshotView ? shotCard : gameCard).join('');
  $('gallery').setAttribute('aria-busy', 'false');
  $('gallery').hidden = !items.length;
  $('empty-state').hidden = !!items.length;
  $('empty-message').textContent = state.library === 'favorites' && !board.favorites.length ? '스크린샷을 열고 하트를 누르면 이곳에 모여요.' : '검색어나 필터를 조금 바꿔보세요.';
  const emptyButton = $('empty-state').querySelector('button');
  const emptyFavorites = state.library === 'favorites' && !board.favorites.length;
  emptyButton.dataset.action = emptyFavorites ? 'library' : 'reset';
  emptyButton.dataset.value = 'all';
  emptyButton.textContent = emptyFavorites ? '레퍼런스 둘러보기' : '필터 초기화';
  $('result-count').textContent = state.game ? `${shotCount.toLocaleString()}개의 장면` : `${list.length.toLocaleString()}개의 게임`;
  $('result-subtitle').textContent = state.game ? '' : `${shotCount.toLocaleString()}장`;
  $('visible-count').textContent = items.length ? `${items.length.toLocaleString()}${screenshotView ? '장' : '개'} 중 ${rendered.length.toLocaleString()}${screenshotView ? '장' : '개'} 표시` : '';
  $('load-more').hidden = rendered.length >= items.length;
  $('game-context').hidden = !state.game;
  if (state.game) {
    const game = gamesById.get(state.game);
    $('game-context').innerHTML = `<button class="game-back" data-action="back">전체 목록으로 돌아가기</button><h2>${escapeHTML(game.title)}</h2><p>${escapeHTML(game.note)}</p><a class="source-link" href="${escapeHTML(game.source)}" target="_blank" rel="noopener noreferrer">${escapeHTML(game.sourceLabel)}에서 보기</a>`;
  }
  renderDock();
}

function renderDock() {
  $('compare-dock').hidden = !state.compare.length;
  $('compare-count').textContent = `${state.compare.length}개 선택 / 최대 4개`;
  $('compare-open').disabled = state.compare.length < 2;
}

function resetFilters() {
  Object.assign(state, { dimension: '', style: '', query: '', side: false, game: '', limit: PAGE_SIZE });
  history.replaceState(null, '', location.pathname + location.search);
}
function update(patch) {
  Object.assign(state, { limit: PAGE_SIZE }, patch);
  render();
}
function openGame(id) {
  if (!gamesById.has(id)) return;
  Object.assign(state, { game: id, dimension: '', style: '', query: '', side: false, limit: PAGE_SIZE });
  history.replaceState(null, '', `#game=${encodeURIComponent(id)}`);
  render();
  $('game-context').scrollIntoView({ behavior: 'instant', block: 'start' });
}
function favorite(id) {
  if (!shotsById.has(id)) return;
  board.favorites = isFavorite(id) ? board.favorites.filter((item) => item !== id) : [...board.favorites, id];
  persistBoard();
  const scroll = window.scrollY;
  render();
  window.scrollTo({ top: scroll, behavior: 'instant' });
  if ($('lightbox').open) renderLightbox(false);
}
function compareSelect(id) {
  if (!shotsById.has(id)) return;
  if (isCompared(id)) state.compare = state.compare.filter((item) => item !== id);
  else if (state.compare.length >= 4) { notify('한 번에 최대 4개 장면을 비교할 수 있어요.'); return; }
  else state.compare.push(id);
  const scroll = window.scrollY;
  render();
  window.scrollTo({ top: scroll, behavior: 'instant' });
  if ($('lightbox').open) renderLightbox(false);
}

function openShot(id) {
  const entry = shotsById.get(id);
  if (!entry) return;
  lightboxGame = entry.game.id;
  lightboxIndex = entry.game.screenshots.findIndex((item) => item.id === id);
  renderLightbox();
  $('lightbox').showModal();
  document.body.style.overflow = 'hidden';
}
function renderLightbox(resetScroll = true) {
  const game = gamesById.get(lightboxGame);
  const shot = game.screenshots[lightboxIndex];
  const asideScroll = $('lightbox').querySelector('.lightbox-aside')?.scrollTop || 0;
  $('lightbox').innerHTML = `<div class="lightbox-heading"><div><h2 id="lightbox-title">${escapeHTML(game.title)}</h2><p>${escapeHTML(game.searchTerms)} / ${lightboxIndex + 1} of ${game.screenshots.length}</p></div><button class="icon-button" data-action="close-shot" aria-label="확대 보기 닫기">×</button></div>
    <div class="lightbox-main"><div class="lightbox-stage"><img src="${escapeHTML(shot.full)}" alt="${escapeHTML(game.title)} 공식 스크린샷 ${lightboxIndex + 1}"><button class="image-nav prev" data-action="prev-shot" aria-label="이전 스크린샷">‹</button><button class="image-nav next" data-action="next-shot" aria-label="다음 스크린샷">›</button></div>
    <aside class="lightbox-aside">${badge(game)}<div class="card-tags">${game.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join('')}</div><p>${escapeHTML(game.note)}</p><div class="detail-actions"><button class="${isFavorite(shot.id) ? 'selected' : ''}" data-action="favorite" data-id="${shot.id}" aria-pressed="${isFavorite(shot.id)}">${isFavorite(shot.id) ? '♥ 선택한 장면' : '♡ 마음에 드는 장면'}</button><button class="${isCompared(shot.id) ? 'selected' : ''}" data-action="select-compare" data-id="${shot.id}" aria-pressed="${isCompared(shot.id)}">${isCompared(shot.id) ? '비교에서 빼기' : '▥ 비교에 담기'}</button></div>
    <label class="note-label" for="shot-note">어떤 점이 마음에 드나요?</label><textarea id="shot-note" data-shot-id="${shot.id}" maxlength="2000" placeholder="색감, 캐릭터 비례, 배경의 질감…">${escapeHTML(board.notes[shot.id] || '')}</textarea><p class="storage-caption">${storageAvailable ? '이 브라우저에 자동 저장' : '현재 브라우저에 저장할 수 없음. 내 선택 내보내기로 보관하세요.'}</p><a class="source-link" href="${escapeHTML(shot.full)}" target="_blank" rel="noopener noreferrer">원본 이미지 열기</a><br><a class="source-link" href="${escapeHTML(shot.source)}" target="_blank" rel="noopener noreferrer">공식 출처 보기</a><div class="detail-credit">${escapeHTML(game.credit || [...(game.developers || []), ...(game.publishers || [])].filter((item, index, array) => array.indexOf(item) === index).join(' / '))}</div></aside></div>
    <div class="filmstrip" aria-label="이 게임의 스크린샷">${game.screenshots.map((item, index) => `<button class="${index === lightboxIndex ? 'active' : ''}" data-action="filmstrip" data-index="${index}" aria-label="스크린샷 ${index + 1}" aria-pressed="${index === lightboxIndex}">${imageHTML(item, game, index)}</button>`).join('')}</div>`;
  if (resetScroll) $('lightbox').scrollTop = 0;
  else $('lightbox').querySelector('.lightbox-aside').scrollTop = asideScroll;
  $('lightbox').querySelector('.filmstrip .active')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}
function moveShot(amount) {
  const length = gamesById.get(lightboxGame).screenshots.length;
  lightboxIndex = (lightboxIndex + amount + length) % length;
  renderLightbox();
}
function openComparison() {
  if (state.compare.length < 2) return;
  if ($('lightbox').open) $('lightbox').close();
  $('compare-dialog').innerHTML = `<div class="dialog-heading"><h2 id="compare-title">마음에 드는 장면, 나란히</h2><button class="icon-button" data-action="close-compare" aria-label="비교 닫기">×</button></div><div class="compare-grid">${state.compare.map((id) => {
    const { game, shot } = shotsById.get(id);
    return `<article class="comparison-panel"><div class="comparison-image"><img src="${escapeHTML(shot.full)}" alt="${escapeHTML(game.title)} 비교 스크린샷"></div><div class="comparison-meta"><h3>${escapeHTML(game.title)} ${badge(game)}</h3><p>${escapeHTML(board.notes[id] || game.tags.join(' / '))}</p><a class="source-link" href="${escapeHTML(shot.source)}" target="_blank" rel="noopener noreferrer">공식 출처 보기</a></div></article>`;
  }).join('')}</div>`;
  $('compare-dialog').showModal();
  document.body.style.overflow = 'hidden';
}

function exportBoard() {
  const file = new Blob([JSON.stringify({ ...board, exportedAt: new Date().toISOString(), gallery: 'muscle-mon-team/game-art-references' }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `frame-my-references-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || !catalog) return;
  const { action, value, id } = button.dataset;
  switch (action) {
    case 'library': resetFilters(); update({ library: value }); break;
    case 'dimension': state.game = ''; history.replaceState(null, '', location.pathname + location.search); update({ dimension: value }); break;
    case 'style': update({ style: state.style === value ? '' : value, game: '' }); history.replaceState(null, '', location.pathname + location.search); break;
    case 'view': if (state.game && value === 'games') resetFilters(); update({ view: value }); break;
    case 'reset': resetFilters(); render(); break;
    case 'more': state.limit += PAGE_SIZE; render(); break;
    case 'game': openGame(id); break;
    case 'back': resetFilters(); render(); break;
    case 'shot': openShot(id); break;
    case 'favorite': favorite(id); break;
    case 'select-compare': compareSelect(id); break;
    case 'clear-compare': state.compare = []; render(); break;
    case 'compare': openComparison(); break;
    case 'close-shot': $('lightbox').close(); break;
    case 'prev-shot': moveShot(-1); break;
    case 'next-shot': moveShot(1); break;
    case 'filmstrip': lightboxIndex = Number(button.dataset.index); renderLightbox(); break;
    case 'close-compare': $('compare-dialog').close(); break;
    case 'info': $('info-dialog').showModal(); break;
    case 'close-info': $('info-dialog').close(); break;
    case 'export': exportBoard(); break;
    case 'import': $('import-file').click(); break;
  }
});
document.addEventListener('error', (event) => {
  if (event.target instanceof HTMLImageElement) event.target.parentElement.classList.add('image-failed');
}, true);
document.addEventListener('input', (event) => {
  if (event.target.id === 'shot-note') {
    const id = event.target.dataset.shotId;
    if (event.target.value.trim()) board.notes[id] = event.target.value;
    else delete board.notes[id];
    persistBoard();
  }
});
$('search').addEventListener('input', (event) => {
  state.game = '';
  history.replaceState(null, '', location.pathname + location.search);
  update({ query: event.target.value });
});
$('side-only').addEventListener('change', (event) => update({ side: event.target.checked }));
$('sort').addEventListener('change', (event) => update({ sort: event.target.value }));
$('import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('5MB 이하의 선택 파일을 사용해주세요.');
    const incoming = validateBoard(JSON.parse(await file.text()));
    board.favorites = [...new Set([...board.favorites, ...incoming.favorites])];
    board.notes = { ...board.notes, ...incoming.notes };
    persistBoard();
    render();
    notify('가져온 선택과 메모를 기존 보드에 합쳤어요.');
  } catch (error) { notify(error instanceof SyntaxError ? '올바른 JSON 파일을 사용해주세요.' : error.message); }
  event.target.value = '';
});
document.addEventListener('keydown', (event) => {
  const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
  if ($('lightbox').open && !editing) {
    if (event.key === 'ArrowRight') { event.preventDefault(); moveShot(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); moveShot(-1); }
  }
  if (event.key === '/' && !editing && !document.querySelector('dialog[open]')) { event.preventDefault(); $('search').focus(); }
});
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.body.style.overflow = '';
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
}

async function initialize() {
  try {
    const response = await fetch('./data/catalog.json');
    if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
    catalog = await response.json();
    gamesById = new Map(); shotsById = new Map();
    catalog.games.forEach((game, index) => {
      game.catalogOrder = index;
      game.searchIndex = normalize([game.title, game.searchTerms, game.dimension, game.camera, ...game.tags, game.note].join(' '));
      gamesById.set(game.id, game);
      game.screenshots.forEach((shot) => shotsById.set(shot.id, { game, shot }));
    });
    readBoard();
    const hash = new URLSearchParams(location.hash.slice(1));
    if (gamesById.has(hash.get('game'))) state.game = hash.get('game');
    $('total-games').textContent = catalog.games.length.toLocaleString();
    $('total-shots').textContent = shotsById.size.toLocaleString();
    $('catalog-date').textContent = `수집 기준 ${catalog.collectedOn} / 공식 스크린샷 URL 라이브러리`;
    render();
    if (!storageAvailable) notify('브라우저 저장을 사용할 수 없어요. 내 선택 내보내기로 보관할 수 있습니다.');
  } catch (error) {
    $('gallery').innerHTML = '<div class="loading-state">자료를 불러오지 못했어요. 네트워크 연결을 확인한 뒤 새로고침해주세요.</div>';
    $('gallery').setAttribute('aria-busy', 'false');
    $('result-count').textContent = '자료를 불러오지 못했어요';
    console.error(error);
  }
}
initialize();
