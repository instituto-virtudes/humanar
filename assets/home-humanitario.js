(() => {
  const track = document.getElementById('human-photo-strip');
  if (!track) return;
  const controls = document.querySelector('.human-photo-controls');
  const previous = document.querySelector('[data-human-prev]');
  const next = document.querySelector('[data-human-next]');
  const position = document.querySelector('[data-human-position]');
  const cards = [...track.children];
  if (!controls || !previous || !next || !position || !cards.length) return;
  const mobile = matchMedia('(max-width: 1100px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const metrics = () => {
    const width = cards[0].getBoundingClientRect().width;
    if (!width) return { width: 0, start: 0, visible: cards.length };
    const visible = Math.max(1, Math.round(track.clientWidth / width));
    const start = Math.max(0, Math.min(cards.length - visible, Math.round(track.scrollLeft / width)));
    return { width, start, visible };
  };
  const update = () => {
    const { start, visible } = metrics();
    const end = Math.min(cards.length, start + visible);
    previous.disabled = start === 0;
    next.disabled = end === cards.length;
    const label = visible === 1 ? `${start + 1} de ${cards.length}` : `${start + 1}–${end} de ${cards.length}`;
    if (position.textContent !== label) position.textContent = label;
  };
  const move = direction => {
    const { width, start, visible } = metrics();
    const target = Math.max(0, Math.min(cards.length - visible, start + direction));
    track.scrollTo({ left: target * width, behavior: reduced.matches ? 'auto' : 'smooth' });
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('scroll', update, { passive: true });
  track.addEventListener('keydown', event => {
    if (!mobile.matches) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  window.addEventListener('resize', update);
  controls.hidden = false;
  update();
})();
