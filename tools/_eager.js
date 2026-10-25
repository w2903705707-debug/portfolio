(() => {
  document.querySelectorAll('img').forEach((i) => {
    i.loading = 'eager';
    const s = i.getAttribute('src');
    i.setAttribute('src', s);
  });
  return Promise.all(
    [...document.images].map((i) => i.decode().catch(() => 0))
  ).then(() => 'images=' + document.images.length);
})()
