/* Idiomas do Humanar: tradução gratuita, endereços compartilháveis e terminologia. */
(() => {
  'use strict';
  if (window.humanarLocaleRedirecting) return;
  const languages = ['pt', 'en', 'es'];
  const prefixes = {en: 'eng', es: 'esp'};
  const names = {pt: 'Português', en: 'English', es: 'Español'};
  const messages = {pt: 'Site em português.', en: 'Website in English.', es: 'Sitio en español.'};
  const selector = document.querySelector('.humanar-gtranslate');
  const status = document.getElementById('language-status');
  const error = document.getElementById('language-error');
  const initialFragment = location.hash;
  const normalize = value => {
    const code = String(value || '').toLowerCase().split('-')[0];
    return languages.includes(code) ? code : 'pt';
  };
  const pathLanguage = /^\/(eng|esp)(?:\/|$)/.exec(location.pathname)?.[1];
  const explicitLanguage = pathLanguage === 'eng' ? 'en' : pathLanguage === 'esp' ? 'es' :
    (languages.includes(window.humanarRouteLanguage) ? window.humanarRouteLanguage : null);
  const storedLanguage = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('__GT_TRANSLATE_LANGS') || 'null');
      return saved?.srcLang === 'pt' ? normalize(saved.tgtLang) : 'pt';
    } catch { return 'pt'; }
  };
  let activeLanguage = explicitLanguage || storedLanguage();
  // A restored preference must be visible in the address that the visitor copies.
  if (!explicitLanguage && activeLanguage !== 'pt') {
    const destination = new URL(location.href);
    destination.pathname = '/' + prefixes[activeLanguage] +
      (destination.pathname === '/index.html' ? '/' : destination.pathname);
    window.humanarLocaleRedirecting = true;
    location.replace(destination.href);
    return;
  }
  const persistLanguage = language => {
    try {
      if (language === 'pt') localStorage.removeItem('__GT_TRANSLATE_LANGS');
      else localStorage.setItem('__GT_TRANSLATE_LANGS', JSON.stringify({srcLang: 'pt', tgtLang: language}));
    } catch { /* A link's language works even when browser storage is unavailable. */ }
  };
  if (explicitLanguage) persistLanguage(explicitLanguage);
  // The early head bootstrap already applied the explicit Portuguese choice.
  if (!pathLanguage && new URL(location.href).searchParams.get('lang') === 'pt') {
    const cleaned = new URL(location.href); cleaned.searchParams.delete('lang');
    history.replaceState(history.state, '', cleaned.pathname + cleaned.search + cleaned.hash);
  }

  const canonicalPath = pathname => pathname.replace(/^\/(?:eng|esp)(?=\/|$)/, '') || '/';
  const languageUrl = (value, language, explicitPortuguese = false) => {
    const url = new URL(value, document.baseURI);
    if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) return null;
    const original = canonicalPath(url.pathname);
    if (original.startsWith('/assets/') || !(/\/$|\.html$/i.test(original))) return null;
    const pagePath = original === '/index.html' ? '/' : original;
    url.pathname = language === 'pt' ? pagePath : '/' + prefixes[language] + pagePath;
    url.searchParams.delete('lang');
    if (language === 'pt' && explicitPortuguese) url.searchParams.set('lang', 'pt');
    return url.pathname + url.search + url.hash;
  };
  const rewriteLinks = () => {
    document.querySelectorAll('a[href]').forEach(link => {
      if (link.matches('[data-gt-lang], [download], [data-download-manifest]')) return;
      const href = link.getAttribute('href');
      if (!href || /^(?:mailto:|tel:|javascript:|data:|blob:)/i.test(href)) return;
      const localized = languageUrl(href, activeLanguage);
      if (localized && href !== localized) link.setAttribute('href', localized);
    });
  };
  const setFlagLinks = () => {
    selector?.querySelectorAll('a[data-gt-lang]').forEach(link => {
      const lang = normalize(link.dataset.gtLang);
      link.setAttribute('href', languageUrl(location.href, lang, lang === 'pt'));
      const nativeLang = lang === 'pt' ? 'pt-BR' : lang;
      if (link.lang !== nativeLang) link.lang = nativeLang;
      if (link.getAttribute('aria-label') !== names[lang]) link.setAttribute('aria-label', names[lang]);
      const flag = link.querySelector('img');
      if (flag && flag.getAttribute('alt') !== '') flag.setAttribute('alt', '');
      const selected = lang === activeLanguage;
      link.classList.toggle('gt-current-lang', selected);
      if (selected) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  };

  // Protect the Institute's own field name before translation and repair later output.
  const termPattern = /\b(?:virtologia|virtology|virtolog[ií]a|virology|virolog[ií]a)\b/gi;
  const plainTerm = {pt: 'Virtologia', en: 'Virtology', es: 'Virtología'};
  const termCase = word => word === word.toUpperCase() ? 'upper' : word === word.toLowerCase() ? 'lower' : 'title';
  const styledTerm = (language, casing, original) => {
    if (language === 'pt' && original && /^virtologia$/i.test(original)) return original;
    const term = plainTerm[language];
    return casing === 'upper' ? term.toUpperCase() : casing === 'lower' ? term.toLowerCase() : term;
  };
  const replaceTerms = text => String(text).replace(termPattern, word => styledTerm(activeLanguage, termCase(word), word));
  const protectTerms = () => {
    document.querySelectorAll('[data-humanar-term="virtologia"]').forEach(span => {
      const desired = styledTerm(activeLanguage, span.dataset.humanarTermCase, span.dataset.humanarTermOriginal);
      if (span.textContent !== desired) span.textContent = desired;
    });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      if (!parent || parent.closest('script,style,noscript,textarea,input,select,option,svg,[data-humanar-term]')) continue;
      termPattern.lastIndex = 0;
      if (termPattern.test(node.nodeValue)) texts.push(node);
    }
    texts.forEach(node => {
      const fragment = document.createDocumentFragment(); let offset = 0;
      termPattern.lastIndex = 0;
      for (const match of node.nodeValue.matchAll(termPattern)) {
        fragment.append(document.createTextNode(node.nodeValue.slice(offset, match.index)));
        const span = document.createElement('span');
        span.className = 'notranslate'; span.setAttribute('translate', 'no');
        span.dataset.humanarTerm = 'virtologia'; span.dataset.humanarTermCase = termCase(match[0]);
        span.dataset.humanarTermOriginal = match[0];
        span.textContent = styledTerm(activeLanguage, span.dataset.humanarTermCase, match[0]);
        fragment.append(span); offset = match.index + match[0].length;
      }
      fragment.append(document.createTextNode(node.nodeValue.slice(offset)));
      node.replaceWith(fragment);
    });
    document.querySelectorAll('[alt],[title],[aria-label]').forEach(element => {
      ['alt', 'title', 'aria-label'].forEach(name => {
        if (!element.hasAttribute(name)) return;
        const before = element.getAttribute(name), after = replaceTerms(before);
        if (before !== after) element.setAttribute(name, after);
      });
    });
    document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').forEach(meta => {
      const before = meta.content, after = replaceTerms(before); if (before !== after) meta.content = after;
    });
    const title = replaceTerms(document.title); if (title !== document.title) document.title = title;
  };
  let scheduled = false;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      activeLanguage = explicitLanguage || normalize(document.documentElement.lang);
      // Before the provider updates html.lang, preserve the visitor's saved choice.
      if (!explicitLanguage && activeLanguage === 'pt') activeLanguage = storedLanguage();
      protectTerms(); rewriteLinks(); setFlagLinks();
    });
  };
  protectTerms(); rewriteLinks();
  new MutationObserver(refresh).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ['lang', 'alt', 'title', 'aria-label', 'content']
  });

  window.gtranslateSettings = {
    default_language: 'pt', languages, native_language_names: true,
    detect_browser_language: false, url_structure: 'none',
    wrapper_selector: '.humanar-gtranslate', flag_style: '2d', flag_size: 24,
    alt_flags: {pt: 'brazil', en: 'usa'}
  };
  let readiness;
  const restoreFragment = () => {
    if (!initialFragment || location.hash !== initialFragment || /^#pagina=/.test(initialFragment)) return;
    let id;
    try { id = decodeURIComponent(initialFragment.slice(1)); } catch { return; }
    const target = document.getElementById(id); if (!target) return;
    const scroll = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      if (location.hash === initialFragment) target.scrollIntoView({block: 'start', behavior: 'instant'});
    }));
    scroll();
    Promise.resolve(document.fonts?.ready).then(scroll);
  };
  function ready() {
    if (readiness) return readiness;
    readiness = new Promise((resolve, reject) => {
      if (!window.gt_translate_script) {
        const lib = document.createElement('script');
        lib.src = 'https://cdn.gtranslate.net/widgets/latest/lib.min.js';
        window.gt_translate_script = lib; document.body.appendChild(lib);
      }
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.__GT?.translator?.libReady) { clearInterval(timer); resolve(window.__GT.translator); }
        else if (Date.now() - started > 15000) { clearInterval(timer); readiness = null; reject(new Error('Translation engine unavailable')); }
      }, 40);
    });
    return readiness;
  }
  async function applyLanguage() {
    selector?.setAttribute('aria-busy', 'true'); if (error) error.hidden = true;
    try {
      if (activeLanguage !== 'pt') {
        const engine = await ready();
        if (!engine.finished || normalize(document.documentElement.lang) !== activeLanguage) {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Translation timed out')), 30000);
            engine.resultCallback = () => {
              clearTimeout(timer);
              engine.error ? reject(new Error('Translation unavailable')) : resolve();
            };
            // The official library already starts the valid saved preference on init.
            // Start it explicitly only when storage could not convey the route choice.
            if (storedLanguage() !== activeLanguage || engine.error) window.doGTranslate('pt|' + activeLanguage);
          });
        }
      }
      protectTerms(); rewriteLinks(); setFlagLinks();
      if (status) status.textContent = messages[activeLanguage];
      restoreFragment();
    } catch (_) {
      if (error) error.hidden = false;
    } finally {
      selector?.setAttribute('aria-busy', 'false');
    }
  }

  if (selector) {
    ['pointerenter', 'focusin'].forEach(type => selector.addEventListener(type, event => {
      event.stopImmediatePropagation();
      ready().catch(() => { if (error) error.hidden = false; });
    }, true));
    selector.addEventListener('click', event => {
      const link = event.target.closest('a[data-gt-lang]'); if (!link) return;
      event.stopImmediatePropagation();
      const language = normalize(link.dataset.gtLang);
      const destination = languageUrl(location.href, language, language === 'pt');
      link.setAttribute('href', destination);
      // Retain native links, middle click, keyboard and opening a new tab.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); persistLanguage(language);
      location.assign(destination);
    }, true);
  }
  window.addEventListener('hashchange', setFlagLinks);
  const widget = document.createElement('script');
  widget.src = 'https://cdn.gtranslate.net/widgets/latest/' + (selector ? 'fn' : 'base') + '.js';
  widget.addEventListener('load', () => { setFlagLinks(); applyLanguage(); }, {once: true});
  widget.addEventListener('error', () => { if (error) error.hidden = false; }, {once: true});
  document.head.appendChild(widget);
})();
