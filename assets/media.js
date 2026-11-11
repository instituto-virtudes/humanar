(() => {
  'use strict';

  const objectUrls = new Set();
  const requests = new Set();
  let nextId = 0;

  const statusFor = (control, placement = control) => {
    const status = document.createElement('p');
    status.className = 'small-note';
    status.id = `media-status-${++nextId}`;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    placement.after(status);
    const describedBy = control.getAttribute('aria-describedby');
    control.setAttribute('aria-describedby', [describedBy, status.id].filter(Boolean).join(' '));
    return status;
  };

  const prepareFile = async (reference, progress, signal) => {
    const controller = new AbortController();
    requests.add(controller);
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const manifestUrl = new URL(reference, document.baseURI);
      if (manifestUrl.origin !== location.origin) throw new Error('Invalid manifest origin');
      const response = await fetch(manifestUrl, { signal: controller.signal });
      if (!response.ok) throw new Error('Manifest unavailable');
      const manifest = await response.json();
      if (!manifest || !Array.isArray(manifest.parts) || !manifest.parts.length ||
          !manifest.parts.every(part => typeof part === 'string' && part.length > 0) ||
          !Number.isSafeInteger(manifest.size) || manifest.size <= 0 ||
          typeof manifest.filename !== 'string' || !manifest.filename ||
          typeof manifest.type !== 'string' || !manifest.type) {
        throw new Error('Invalid manifest');
      }

      const parts = [];
      let loaded = 0;
      progress(0);
      for (const part of manifest.parts) {
        const partUrl = new URL(part, manifestUrl);
        if (partUrl.origin !== location.origin) throw new Error('Invalid part origin');
        const partResponse = await fetch(partUrl, { signal: controller.signal });
        if (!partResponse.ok) throw new Error('Part unavailable');
        const blob = await partResponse.blob();
        loaded += blob.size;
        if (loaded > manifest.size) throw new Error('Unexpected file size');
        parts.push(blob);
        progress(Math.floor(loaded / manifest.size * 100));
      }
      if (loaded !== manifest.size) throw new Error('Incomplete file');
      const file = new Blob(parts, { type: manifest.type });
      if (file.size !== manifest.size) throw new Error('Unexpected assembled size');
      const url = URL.createObjectURL(file);
      objectUrls.add(url);
      return { url, filename: manifest.filename };
    } finally {
      signal?.removeEventListener('abort', abort);
      requests.delete(controller);
    }
  };

  document.querySelectorAll('video[data-media-manifest]').forEach(video => {
    if (video.dataset.mediaInitialized) return;
    video.dataset.mediaInitialized = 'true';
    if (!video.id) video.id = `media-video-${++nextId}`;
    if (!video.hasAttribute('tabindex')) video.tabIndex = 0;
    video.controls = false;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary';
    button.textContent = 'Carregar vídeo';
    button.setAttribute('aria-controls', video.id);
    video.after(button);
    const status = statusFor(button);
    status.textContent = 'Selecione “Carregar vídeo” para assistir.';
    video.setAttribute('aria-describedby', [video.getAttribute('aria-describedby'), status.id].filter(Boolean).join(' '));
    let loading = false;
    let ready = false;

    button.addEventListener('click', async () => {
      if (loading) return;
      if (ready) {
        try {
          await video.play();
          video.focus();
          status.textContent = '';
        } catch {
          status.textContent = 'Use o botão de reprodução do vídeo para assistir.';
          video.focus();
        }
        return;
      }

      loading = true;
      button.disabled = true;
      button.textContent = 'Carregando vídeo…';
      video.setAttribute('aria-busy', 'true');
      try {
        const file = await prepareFile(video.dataset.mediaManifest, percent => {
          status.textContent = `Carregando vídeo: ${percent}%. Aguarde nesta página.`;
        });
        video.src = file.url;
        video.controls = true;
        video.load();
        ready = true;
        button.textContent = 'Reproduzir vídeo';
        status.textContent = 'Vídeo pronto. Use os controles para assistir.';
        video.focus();
      } catch {
        button.textContent = 'Tentar carregar novamente';
        status.textContent = 'Não foi possível carregar o vídeo. Confira sua conexão e tente novamente.';
      } finally {
        loading = false;
        button.disabled = false;
        video.removeAttribute('aria-busy');
      }
    });
  });

  const downloadMessages = {
    pt: {
      label: 'Baixar apresentação em PDF ↓',
      preparing: 'Preparando apresentação…',
      progress: percent => `Preparando apresentação: ${percent}%. Aguarde nesta página.`,
      ready: 'Apresentação pronta. Selecione o botão de download para salvar.',
      retry: 'Tentar baixar novamente ↓',
      error: 'Não foi possível preparar a apresentação. Confira sua conexão e tente novamente.'
    },
    en: {
      label: 'Download presentation as PDF ↓',
      preparing: 'Preparing presentation…',
      progress: percent => `Preparing presentation: ${percent}%. Please stay on this page.`,
      ready: 'Presentation ready. Select the download button to save it.',
      retry: 'Try downloading again ↓',
      error: 'The presentation could not be prepared. Check your connection and try again.'
    },
    es: {
      label: 'Descargar presentación en PDF ↓',
      preparing: 'Preparando presentación…',
      progress: percent => `Preparando presentación: ${percent}%. Espere en esta página.`,
      ready: 'Presentación lista. Seleccione el botón de descarga para guardarla.',
      retry: 'Intentar descargar de nuevo ↓',
      error: 'No se pudo preparar la presentación. Revise su conexión e inténtelo de nuevo.'
    }
  };
  const normalizeLanguage = value => {
    const language = String(value || '').toLowerCase().split('-')[0];
    return language === 'en' || language === 'es' ? language : 'pt';
  };
  const savedDownloadLanguage = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('__GT_TRANSLATE_LANGS') || 'null');
      return saved?.srcLang === 'pt' ? normalizeLanguage(saved.tgtLang) : 'pt';
    } catch {
      return 'pt';
    }
  };
  const releaseFile = file => {
    if (file && objectUrls.delete(file.url)) URL.revokeObjectURL(file.url);
  };

  document.querySelectorAll('a[data-download-manifest]').forEach(link => {
    if (link.dataset.mediaInitialized) return;
    link.dataset.mediaInitialized = 'true';
    const originalLabel = link.textContent;
    const originalHref = link.getAttribute('href');
    const originalManifest = link.dataset.downloadManifest;
    const languageAware = Boolean(link.dataset.downloadManifestEn && link.dataset.downloadManifestEs);
    const manifests = {
      pt: link.dataset.downloadManifestPt || originalManifest,
      en: link.dataset.downloadManifestEn,
      es: link.dataset.downloadManifestEs
    };
    const status = statusFor(link, link.closest('.buttons') || link);
    let documentLanguage = normalizeLanguage(document.documentElement.lang);
    // On an internal page, the saved language is available before GTranslate finishes loading.
    let language = documentLanguage === 'pt' ? savedDownloadLanguage() : documentLanguage;
    let loading = false;
    let ready = false;
    let preparedFile = null;
    let pending = null;
    let revision = 0;
    const messages = () => downloadMessages[languageAware ? language : 'pt'];
    const label = () => languageAware ? messages().label : originalLabel;

    const applyLanguage = (nextLanguage, initial = false) => {
      if (!languageAware || (!initial && nextLanguage === language)) return;
      language = nextLanguage;
      revision += 1;
      pending?.abort();
      pending = null;
      releaseFile(preparedFile);
      preparedFile = null;
      loading = false;
      ready = false;
      if (originalHref === null) link.removeAttribute('href');
      else link.setAttribute('href', originalHref);
      link.removeAttribute('download');
      link.removeAttribute('aria-disabled');
      link.removeAttribute('aria-busy');
      link.dataset.downloadManifest = manifests[language];
      link.dataset.downloadLanguage = language;
      link.textContent = label();
      status.textContent = '';
      const lang = language === 'pt' ? 'pt-BR' : language;
      link.lang = lang;
      status.lang = lang;
    };

    if (languageAware) {
      [link, status].forEach(element => {
        element.classList.add('notranslate');
        element.setAttribute('translate', 'no');
      });
      applyLanguage(language, true);
      new MutationObserver(() => {
        documentLanguage = normalizeLanguage(document.documentElement.lang);
        applyLanguage(documentLanguage);
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      window.addEventListener('storage', event => {
        if (event.key === '__GT_TRANSLATE_LANGS' || event.key === null) {
          applyLanguage(savedDownloadLanguage());
        }
      });
    }

    link.addEventListener('click', async event => {
      if (languageAware) {
        const currentDocumentLanguage = normalizeLanguage(document.documentElement.lang);
        if (currentDocumentLanguage !== documentLanguage) {
          documentLanguage = currentDocumentLanguage;
          applyLanguage(documentLanguage);
        }
      }
      if (ready) return;
      event.preventDefault();
      if (loading) return;
      loading = true;
      const requestRevision = ++revision;
      const requestLanguage = language;
      const controller = new AbortController();
      pending = controller;
      const currentMessages = messages();
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('aria-busy', 'true');
      link.textContent = currentMessages.preparing;
      try {
        const file = await prepareFile(link.dataset.downloadManifest, percent => {
          if (revision === requestRevision) status.textContent = currentMessages.progress(percent);
        }, controller.signal);
        // A previous language must never replace the newly selected PDF.
        if (revision !== requestRevision || requestLanguage !== language) {
          releaseFile(file);
          return;
        }
        preparedFile = file;
        link.href = file.url;
        link.download = file.filename;
        link.textContent = label();
        ready = true;
        status.textContent = currentMessages.ready;
      } catch {
        if (revision !== requestRevision) return;
        link.textContent = currentMessages.retry;
        status.textContent = currentMessages.error;
      } finally {
        if (revision === requestRevision) {
          loading = false;
          pending = null;
          link.removeAttribute('aria-disabled');
          link.removeAttribute('aria-busy');
        }
      }
    });
  });

  window.addEventListener('pagehide', event => {
    requests.forEach(controller => controller.abort());
    if (event.persisted) return;
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    objectUrls.clear();
  });
})();
