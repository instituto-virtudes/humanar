/* Relatório de ações: páginas visuais e texto no idioma escolhido pelo visitante. */
(() => {
  'use strict';
  const viewer = document.querySelector('[data-presentation-viewer]');
  if (!viewer) return;
  const image = viewer.querySelector('#slide-image');
  const previous = viewer.querySelector('#slide-prev');
  const next = viewer.querySelector('#slide-next');
  const number = viewer.querySelector('#slide-number');
  const content = viewer.querySelector('#slide-text');
  const status = viewer.querySelector('#slide-status');
  const error = viewer.querySelector('#viewer-error');
  const stage = viewer.querySelector('.viewer-stage');
  const total = viewer.querySelector('.viewer-position > span:not(.visually-hidden)');
  const pageLabel = viewer.querySelector('label[for="slide-number"]');
  const summary = viewer.querySelector('details > summary');
  const indexNav = viewer.querySelector('.viewer-index');
  const sectionButtons = [...viewer.querySelectorAll('[data-page]')];
  const pageCount = Number(number.max) || 90;
  const messages = {
    pt: {
      previous: '← Anterior', previousLabel: 'Página anterior', next: 'Próxima →', nextLabel: 'Próxima página',
      page: 'Página', total: count => `de ${count}`, summary: 'Texto desta página',
      section: 'Ir para uma seção da apresentação', sections: ['Início', 'Sistema penitenciário', 'Infância e famílias', 'Comunidades terapêuticas'],
      alt: page => `Página ${page} da apresentação do Humanar`, position: (page, count) => `Página ${page} de ${count}`,
      loading: 'Carregando apresentação…', retry: 'Carregar novamente',
      error: 'Não foi possível carregar a apresentação neste idioma. Tente novamente ou baixe o arquivo abaixo.'
    },
    en: {
      previous: '← Previous', previousLabel: 'Previous page', next: 'Next →', nextLabel: 'Next page',
      page: 'Page', total: count => `of ${count}`, summary: 'Text on this page',
      section: 'Go to a presentation section', sections: ['Home', 'Prison system', 'Children and families', 'Therapeutic communities'],
      alt: page => `Page ${page} of the Humanar presentation`, position: (page, count) => `Page ${page} of ${count}`,
      loading: 'Loading presentation…', retry: 'Try again',
      error: 'The presentation could not be loaded in this language. Try again or download the file below.'
    },
    es: {
      previous: '← Anterior', previousLabel: 'Página anterior', next: 'Siguiente →', nextLabel: 'Página siguiente',
      page: 'Página', total: count => `de ${count}`, summary: 'Texto de esta página',
      section: 'Ir a una sección de la presentación', sections: ['Inicio', 'Sistema penitenciario', 'Infancia y familias', 'Comunidades terapéuticas'],
      alt: page => `Página ${page} de la presentación de Humanar`, position: (page, count) => `Página ${page} de ${count}`,
      loading: 'Cargando presentación…', retry: 'Volver a intentar',
      error: 'No se pudo cargar la presentación en este idioma. Vuelva a intentarlo o descargue el archivo de abajo.'
    }
  };
  const normalizeLanguage = value => {
    const lang = String(value || '').toLowerCase().split('-')[0];
    return lang === 'en' || lang === 'es' ? lang : 'pt';
  };
  const savedLanguage = () => {
    try {
      const value = JSON.parse(localStorage.getItem('__GT_TRANSLATE_LANGS') || 'null');
      return value?.srcLang === 'pt' ? normalizeLanguage(value.tgtLang) : 'pt';
    } catch { return 'pt'; }
  };
  const clamp = value => Math.max(0, Math.min(pageCount - 1, Number.isFinite(value) ? Math.trunc(value) : 0));
  const requestedPage = () => clamp(Number(new URLSearchParams(location.hash.slice(1)).get('pagina') || 1) - 1);
  let documentLanguage = normalizeLanguage(document.documentElement.lang);
  let language = documentLanguage === 'pt' ? savedLanguage() : documentLanguage;
  let index = requestedPage();
  let slides = null;
  let languageRevision = 0;
  let imageRevision = 0;
  const cache = new Map();
  const retry = document.createElement('button');
  retry.type = 'button'; retry.className = 'button secondary'; retry.hidden = true;
  error.after(retry);

  const hidePage = () => {
    image.style.visibility = 'hidden';
    image.setAttribute('aria-hidden', 'true');
    content.textContent = '';
    viewer.dataset.viewerReady = 'false';
    stage.setAttribute('aria-busy', 'true');
  };
  const controls = () => {
    number.value = String(index + 1);
    previous.disabled = !slides || index === 0;
    next.disabled = !slides || index === pageCount - 1;
  };
  const localize = () => {
    const m = messages[language];
    viewer.lang = language === 'pt' ? 'pt-BR' : language;
    viewer.dataset.viewerLanguage = language;
    previous.textContent = m.previous; previous.setAttribute('aria-label', m.previousLabel);
    next.textContent = m.next; next.setAttribute('aria-label', m.nextLabel);
    pageLabel.textContent = m.page; total.textContent = m.total(pageCount);
    summary.textContent = m.summary; indexNav.setAttribute('aria-label', m.section);
    sectionButtons.forEach((button, i) => { button.textContent = m.sections[i] || button.textContent; });
    image.alt = m.alt(index + 1); retry.textContent = m.retry;
  };
  const fail = revision => {
    if (revision !== languageRevision) return;
    hidePage(); stage.removeAttribute('aria-busy');
    error.textContent = messages[language].error; error.hidden = false;
    retry.hidden = false; status.textContent = messages[language].error;
  };
  const loadSlides = lang => {
    if (cache.has(lang)) return cache.get(lang);
    const reference = viewer.dataset['slides' + lang[0].toUpperCase() + lang.slice(1)];
    const url = new URL(reference, document.baseURI);
    const promise = (async () => {
      if (url.origin !== location.origin) throw new Error('Invalid presentation origin');
      const response = await fetch(url);
      if (!response.ok) throw new Error('Presentation unavailable');
      const data = await response.json();
      if (!Array.isArray(data) || data.length !== pageCount || !data.every(slide => slide &&
          typeof slide.text === 'string' && typeof slide.image === 'string' &&
          new URL(slide.image, document.baseURI).origin === location.origin)) throw new Error('Invalid presentation');
      return data;
    })().catch(error => { cache.delete(lang); throw error; });
    cache.set(lang, promise);
    return promise;
  };
  const show = async (value, setHash = true) => {
    index = clamp(value); controls();
    if (setHash) history.replaceState(null, '', `#pagina=${index + 1}`);
    if (!slides) return;
    const slide = slides[index];
    const expectedLanguage = languageRevision;
    const expectedImage = ++imageRevision;
    const expectedIndex = index;
    hidePage(); error.hidden = true; retry.hidden = true;
    status.textContent = messages[language].loading;
    try {
      const preload = new Image();
      await new Promise((resolve, reject) => {
        preload.onload = resolve; preload.onerror = reject; preload.src = slide.image;
      });
      if (languageRevision !== expectedLanguage || imageRevision !== expectedImage || index !== expectedIndex) return;
      image.src = slide.image; image.alt = messages[language].alt(index + 1);
      if (typeof image.decode === 'function') await image.decode();
      if (languageRevision !== expectedLanguage || imageRevision !== expectedImage || index !== expectedIndex) return;
      content.textContent = slide.text;
      image.style.visibility = 'visible'; image.removeAttribute('aria-hidden');
      viewer.dataset.viewerReady = 'true'; stage.removeAttribute('aria-busy');
      status.textContent = messages[language].position(index + 1, slides.length);
      if (index + 1 < slides.length) { const adjacent = new Image(); adjacent.src = slides[index + 1].image; }
    } catch {
      if (imageRevision === expectedImage && index === expectedIndex) fail(expectedLanguage);
    }
  };
  const changeLanguage = async (value, force = false) => {
    const nextLanguage = normalizeLanguage(value);
    if (!force && nextLanguage === language) return;
    language = nextLanguage;
    const revision = ++languageRevision;
    imageRevision += 1; slides = null; hidePage(); localize(); controls();
    error.hidden = true; retry.hidden = true; status.textContent = messages[language].loading;
    try {
      const data = await loadSlides(language);
      if (revision !== languageRevision) return;
      slides = data; controls(); show(index, false);
    } catch { fail(revision); }
  };

  previous.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  number.addEventListener('change', () => show(Number(number.value) - 1));
  sectionButtons.forEach(button => button.addEventListener('click', () => show(Number(button.dataset.page) - 1)));
  window.addEventListener('hashchange', () => show(requestedPage(), false));
  viewer.addEventListener('keydown', event => {
    if (event.target.matches('input')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); show(index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  retry.addEventListener('click', () => changeLanguage(language, true));
  new MutationObserver(() => {
    const actualLanguage = normalizeLanguage(document.documentElement.lang);
    if (actualLanguage === documentLanguage) return;
    documentLanguage = actualLanguage; changeLanguage(actualLanguage);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  window.addEventListener('storage', event => {
    if (event.key === '__GT_TRANSLATE_LANGS' || event.key === null) changeLanguage(savedLanguage());
  });
  changeLanguage(language, true);
})();
