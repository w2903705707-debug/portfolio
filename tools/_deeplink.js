(() => {
  const r = {};
  const modalOpen = () => document.querySelector('#modal').classList.contains('open');

  r.initialOpen = modalOpen();
  r.hasIframe = !!document.querySelector('#modalStage iframe');
  r.iframeSrc = document.querySelector('#modalStage iframe')?.getAttribute('src') || null;
  r.title = document.querySelector('#modalTitle')?.textContent || null;

  const hiddenId = 'w04';
  const present = [...document.querySelectorAll('#libraryGrid .card')].some(
    (c) => c.dataset.id === hiddenId
  );
  r.hiddenWorkRenderedInGrid = present;

  const single = [...document.querySelectorAll('#libraryGrid .card')].map((c) => c.dataset.id);
  r.gridCount = single.length;

  return JSON.stringify(r);
})()
