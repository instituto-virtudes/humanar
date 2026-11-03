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

  const prepareFile = async (reference, progress) => {
    const controller = new AbortController();
    requests.add(controller);
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

  document.querySelectorAll('a[data-download-manifest]').forEach(link => {
    if (link.dataset.mediaInitialized) return;
    link.dataset.mediaInitialized = 'true';
    const label = link.textContent;
    const status = statusFor(link, link.closest('.buttons') || link);
    let loading = false;
    let ready = false;

    link.addEventListener('click', async event => {
      if (ready) return;
      event.preventDefault();
      if (loading) return;
      loading = true;
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('aria-busy', 'true');
      link.textContent = 'Preparando apresentação…';
      try {
        const file = await prepareFile(link.dataset.downloadManifest, percent => {
          status.textContent = `Preparando apresentação: ${percent}%. Aguarde nesta página.`;
        });
        link.href = file.url;
        link.download = file.filename;
        link.textContent = label;
        ready = true;
        status.textContent = 'Apresentação pronta. Selecione o botão de download para salvar.';
      } catch {
        link.textContent = 'Tentar baixar novamente ↓';
        status.textContent = 'Não foi possível preparar a apresentação. Confira sua conexão e tente novamente.';
      } finally {
        loading = false;
        link.removeAttribute('aria-disabled');
        link.removeAttribute('aria-busy');
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
