(() => {
  const r = {};
  const F = [...document.querySelectorAll('.filter')];
  const cnt = () => document.querySelectorAll('#libraryGrid .card').length;

  r.all = cnt();

  F.find((x) => x.dataset.cat === 'aigc').click();
  r.aigc = cnt();
  r.onCat = document.querySelector('.filter.on').dataset.cat;

  F.find((x) => x.dataset.cat === 'mix').click();
  r.mix = cnt();

  F.find((x) => x.dataset.cat === 'all').click();
  r.backAll = cnt();

  r.featuredCards = document.querySelectorAll('#featuredGrid .card').length;
  r.featuredBadgesInLibrary = document.querySelectorAll('#libraryGrid .badge-tl').length;

  document.querySelector('#libraryGrid .card').click();
  r.modalOpen = document.querySelector('#modal').classList.contains('open');
  r.title = document.querySelector('#modalTitle').textContent;
  r.counter = document.querySelector('#modalCount').textContent;
  r.hasIframe = !!document.querySelector('#modalStage iframe');
  r.hasPlaceholder = !!document.querySelector('#modalStage .ph');
  r.scrollLocked = document.body.style.overflow;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  r.afterRight = document.querySelector('#modalTitle').textContent;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  r.closedByEsc = !document.querySelector('#modal').classList.contains('open');
  r.scrollReleased = document.body.style.overflow === '' ? 'yes' : document.body.style.overflow;

  const abil = document.querySelector('.abil');
  abil.click();
  r.abilityJumpFilter = document.querySelector('.filter.on').dataset.cat;
  r.abilityJumpCount = document.querySelectorAll('#libraryGrid .card').length;

  return JSON.stringify(r);
})()
