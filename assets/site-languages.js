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

  // Let the provider translate complete sentences. Splitting a word into a
  // notranslate span first loses grammatical context and can glue its neighbors.
  // Remember where the source discusses Virtologia, then repair only that field's
  // translated words in their existing text nodes. Portuguese is never rewritten.
  const sourceTermPattern = /\b(?:virtolog[ií]a|virtol[oó]gicamente|virtol[oó]gic[oa]s?|virt[oó]log[oa]s?)\b/gi;
  const termPattern = /\b(?:virtolog[ií]a|virtology|virolog[ií]a|virology|virtol[oó]gicamente|virol[oó]gicamente|virtologically|virologically|virtol[oó]gic[oa]s?|virol[oó]gic[oa]s?|virtological|virological|virt[oó]log[oa]s?|vir[oó]log[oa]s?|virtologists?|virologists?|virtuosamente|virtuously)\b/gi;
  const termScopes = new WeakMap();
  const originalTitle = document.title;
  const termAttributes = new WeakMap();
  const skippedTerms = 'script,style,noscript,textarea,input,select,option,svg,.notranslate,[translate="no"]';
  const semanticScope = 'p,h1,h2,h3,h4,h5,h6,li,figcaption,td,th,blockquote,button,a,label';
  const termKind = word => /(?:icamente|ically|osamente|uously)$/i.test(word) ? 'adverb' :
    /(?:ological|[oó]gic[oa]s?)$/i.test(word) ? 'adjective' :
    /(?:log[ií]a|logy)$/i.test(word) ? 'noun' : 'person';
  const sourceWords = text => [...String(text).matchAll(sourceTermPattern)].map(match => match[0]);
  const rememberScope = (element, words) => {
    if (!words.length) return;
    const saved = termScopes.get(element) || [];
    termScopes.set(element, [...new Set([...saved, ...words])]);
  };
  const rememberAttribute = (element, name, text) => {
    const words = sourceWords(text);
    if (!words.length) return;
    const attributes = termAttributes.get(element) || new Map();
    if (!attributes.has(name)) attributes.set(name, {words, original: String(text)});
    termAttributes.set(element, attributes);
  };
  const rememberTermContexts = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      if (!parent || parent.closest(skippedTerms)) continue;
      const words = sourceWords(node.nodeValue);
      if (!words.length) continue;
      rememberScope(parent, words);
      const block = parent.closest(semanticScope);
      if (block) rememberScope(block, words);
    }
    document.querySelectorAll('[alt],[title],[aria-label],meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').forEach(element => {
      if (element.closest(skippedTerms)) return;
      ['alt', 'title', 'aria-label', 'content'].forEach(name => {
        if (element.hasAttribute(name)) rememberAttribute(element, name, element.getAttribute(name));
      });
    });
    rememberScope(document.head, sourceWords(document.title));
  };
  const scopeFor = element => {
    for (let parent = element; parent; parent = parent.parentElement) {
      const scope = termScopes.get(parent);
      if (scope) return scope;
    }
    return null;
  };
  const termCase = word => word === word.toUpperCase() ? 'upper' : word === word.toLowerCase() ? 'lower' : 'title';
  const translatedTerm = (word, source) => {
    const kind = termKind(word), lower = word.toLowerCase();
    // A moral adverb is only a mistranslation when the source used the field's adverb.
    if (/^(?:virtuosamente|virtuously)$/i.test(word) && !source.some(value => termKind(value) === 'adverb')) return word;
    let replacement;
    if (kind === 'noun') replacement = activeLanguage === 'en' ? 'Virtology' : 'Virtología';
    else if (kind === 'adverb') replacement = activeLanguage === 'en' ? 'virtologically' : 'virtológicamente';
    else {
      const original = source.find(value => termKind(value) === kind) || '';
      const ending = lower.match(/([oa])(s?)$/) || original.toLowerCase().match(/([oa])(s?)$/);
      const plural = /s$/i.test(word);
      if (activeLanguage === 'en') replacement = kind === 'adjective' ? 'virtological' : 'virtologist' + (plural ? 's' : '');
      else replacement = (kind === 'adjective' ? 'virtológic' : 'virtólog') +
        (ending?.[1] || 'o') + (plural ? 's' : '');
    }
    const casing = termCase(word);
    return casing === 'upper' ? replacement.toUpperCase() : casing === 'lower' ? replacement.toLowerCase() :
      replacement[0].toUpperCase() + replacement.slice(1);
  };
  const replaceTerms = (text, source) => !source ? text : String(text).replace(termPattern, word => translatedTerm(word, source));
  const protectTerms = () => {
    rememberTermContexts();
    const engine = window.__GT?.translator;
    if (activeLanguage === 'pt' || !engine?.finished || engine.error) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      // The provider lazily translates off-screen blocks even after finished=true.
      // Its generated font wrappers identify translated text; never modify the
      // still-Portuguese nodes awaiting that later viewport pass.
      if (!parent || parent.closest(skippedTerms) || !parent.closest('font[dir="auto"]')) continue;
      const before = node.nodeValue, after = replaceTerms(before, scopeFor(parent));
      if (before !== after) node.nodeValue = after;
    }
    document.querySelectorAll('[alt],[title],[aria-label],meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').forEach(element => {
      if (element.closest(skippedTerms)) return;
      const attributes = termAttributes.get(element);
      if (!attributes) return;
      for (const [name, source] of attributes) {
        const before = element.getAttribute(name);
        if (before === null || before === source.original) continue;
        const after = replaceTerms(before, source.words);
        if (before !== after) element.setAttribute(name, after);
      }
    });
    const title = document.title === originalTitle ? document.title :
      replaceTerms(document.title, termScopes.get(document.head));
    if (title !== document.title) document.title = title;
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
