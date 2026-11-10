/* Integração com o widget gratuito oficial do GTranslate. */
(() => {
  'use strict';
  const selector = document.querySelector('.humanar-gtranslate');
  const status = document.getElementById('language-status');
  const error = document.getElementById('language-error');
  const languages = ['pt', 'en', 'es'];
  const names = {pt: 'Português', en: 'English', es: 'Español'};
  const messages = {pt: 'Site em português.', en: 'Website in English.', es: 'Sitio en español.'};
  let busy = false;

  window.gtranslateSettings = {
    default_language: 'pt', languages,
    native_language_names: true,
    detect_browser_language: false,
    url_structure: 'none',
    wrapper_selector: '.humanar-gtranslate',
    flag_style: '2d', flag_size: 24,
    alt_flags: {pt: 'brazil', en: 'usa'}
  };

  function currentLanguage(lang) {
    selector?.querySelectorAll('a[data-gt-lang]').forEach(link => {
      const selected = link.dataset.gtLang === lang;
      link.classList.toggle('gt-current-lang', selected);
      if (selected) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  function ready() {
    return new Promise((resolve, reject) => {
      if (!window.gt_translate_script) {
        const lib = document.createElement('script');
        lib.src = 'https://cdn.gtranslate.net/widgets/latest/lib.min.js';
        window.gt_translate_script = lib;
        document.body.appendChild(lib);
      }
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.__GT?.translator?.libReady) {
          clearInterval(timer); resolve(window.__GT.translator);
        } else if (Date.now() - started > 15000) {
          clearInterval(timer); reject(new Error('Translation engine unavailable'));
        }
      }, 40);
    });
  }

  async function chooseLanguage(lang) {
    if (busy || !languages.includes(lang)) return;
    busy = true;
    selector.setAttribute('aria-busy', 'true');
    error.hidden = true;
    try {
      const engine = await ready();
      if (lang === 'pt') {
        window.doGTranslate('pt|pt');
      } else {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Translation timed out')), 30000);
          engine.resultCallback = () => {
            clearTimeout(timer);
            if (engine.error) reject(new Error('Translation unavailable'));
            else resolve();
          };
          window.doGTranslate('pt|' + lang);
        });
      }
      currentLanguage(lang);
      status.textContent = messages[lang];
    } catch (_) {
      error.hidden = false;
      currentLanguage(document.documentElement.lang.startsWith('en') ? 'en' : document.documentElement.lang.startsWith('es') ? 'es' : 'pt');
    } finally {
      busy = false;
      selector.setAttribute('aria-busy', 'false');
    }
  }

  if (selector) {
    ['pointerenter', 'focusin'].forEach(type => selector.addEventListener(type, event => {
      event.stopImmediatePropagation();
      ready().catch(() => { error.hidden = false; });
    }, true));
    selector.addEventListener('click', event => {
      const link = event.target.closest('a[data-gt-lang]');
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      chooseLanguage(link.dataset.gtLang);
    }, true);
  }

  const widget = document.createElement('script');
  widget.src = 'https://cdn.gtranslate.net/widgets/latest/' + (selector ? 'fn' : 'base') + '.js';
  widget.addEventListener('load', () => {
    if (!selector) return;
    selector.querySelectorAll('a[data-gt-lang]').forEach(link => {
      const lang = link.dataset.gtLang;
      link.lang = lang === 'pt' ? 'pt-BR' : lang;
      link.setAttribute('aria-label', names[lang]);
      link.querySelector('img')?.setAttribute('alt', '');
      if (link.classList.contains('gt-current-lang')) link.setAttribute('aria-current', 'true');
    });
  }, {once: true});
  widget.addEventListener('error', () => { if (error) error.hidden = false; }, {once: true});
  document.head.appendChild(widget);
})();
