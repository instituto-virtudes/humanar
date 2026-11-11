(() => {
  'use strict';

  // Each translated page supplies its own source and static <track default>.
  // This controller never chooses a language, replaces a track, or autoplays.
  const messages = {
    pt: {
      load: 'Carregar vídeo', cancel: 'Cancelar carregamento', retry: 'Tentar novamente',
      initial: 'Carregue o vídeo para assistir com as legendas disponíveis.',
      preparing: 'Preparando o vídeo…',
      progress: (percent, received, total) => `Carregando vídeo: ${percent}% (${received} de ${total}).`,
      ready: 'Vídeo pronto. Use os controles para assistir.',
      cancelled: 'Carregamento cancelado. Você pode tentar novamente.',
      error: 'Não foi possível carregar o vídeo. Confira sua conexão e tente novamente.'
    },
    en: {
      load: 'Load video', cancel: 'Cancel loading', retry: 'Try again',
      initial: 'Load the video to watch with the available subtitles.',
      preparing: 'Preparing the video…',
      progress: (percent, received, total) => `Loading video: ${percent}% (${received} of ${total}).`,
      ready: 'Video ready. Use the controls to watch.',
      cancelled: 'Loading cancelled. You can try again.',
      error: 'The video could not be loaded. Check your connection and try again.'
    },
    es: {
      load: 'Cargar vídeo', cancel: 'Cancelar carga', retry: 'Intentar de nuevo',
      initial: 'Cargue el vídeo para verlo con los subtítulos disponibles.',
      preparing: 'Preparando el vídeo…',
      progress: (percent, received, total) => `Cargando vídeo: ${percent}% (${received} de ${total}).`,
      ready: 'Vídeo listo. Use los controles para verlo.',
      cancelled: 'Carga cancelada. Puede intentarlo de nuevo.',
      error: 'No se pudo cargar el vídeo. Revise su conexión e inténtelo de nuevo.'
    }
  };
  const pending = new Set();
  const objectUrls = new Set();
  let nextId = 0;

  const languageFor = video => {
    const explicit = String(video.dataset.childrenLang || '').toLowerCase().split('-')[0];
    if (Object.prototype.hasOwnProperty.call(messages, explicit)) return explicit;
    if (/^\/eng(?:\/|$)/i.test(location.pathname)) return 'en';
    if (/^\/esp(?:\/|$)/i.test(location.pathname)) return 'es';
    return 'pt';
  };
  const sameOriginUrl = (reference, base) => {
    const url = new URL(reference, base);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || url.username || url.password) {
      throw new Error('Invalid media origin');
    }
    return url;
  };
  const relativePartUrl = (reference, base) => {
    if (typeof reference !== 'string' || !reference.trim() || /^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.startsWith('//')) {
      throw new Error('Invalid relative media part');
    }
    return sameOriginUrl(reference, base);
  };
  const checkedFetch = async (url, signal) => {
    const response = await fetch(url.href, {
      signal, mode: 'same-origin', credentials: 'same-origin', redirect: 'error'
    });
    if (!response.ok) throw new Error('Media unavailable');
    if (response.url && new URL(response.url).origin !== location.origin) throw new Error('Invalid response origin');
    return response;
  };
  const prepareVideo = async (reference, progress, signal) => {
    const manifestUrl = sameOriginUrl(reference, document.baseURI);
    const response = await checkedFetch(manifestUrl, signal);
    const manifest = await response.json();
    if (!manifest || typeof manifest.filename !== 'string' || !manifest.filename.trim() ||
        typeof manifest.type !== 'string' || !/^video\/[a-z0-9.+-]+$/i.test(manifest.type) ||
        !Number.isSafeInteger(manifest.size) || manifest.size <= 0 ||
        !Array.isArray(manifest.parts) || !manifest.parts.length) {
      throw new Error('Invalid media manifest');
    }
    // Validate every reference before starting any part request.
    const partUrls = manifest.parts.map(part => relativePartUrl(part, manifestUrl));
    const buffers = [];
    let loaded = 0;
    const accept = chunk => {
      if (!chunk || !Number.isSafeInteger(chunk.byteLength) || chunk.byteLength < 0) throw new Error('Invalid media bytes');
      if (loaded + chunk.byteLength > manifest.size) throw new Error('Oversized media');
      buffers.push(chunk);
      loaded += chunk.byteLength;
      progress(loaded, manifest.size);
    };
    progress(0, manifest.size);
    for (const partUrl of partUrls) {
      const partResponse = await checkedFetch(partUrl, signal);
      if (partResponse.body && typeof partResponse.body.getReader === 'function') {
        const reader = partResponse.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accept(value);
          }
        } catch (error) {
          try { await reader.cancel(); } catch { /* The aborted reader is already closed. */ }
          throw error;
        } finally {
          reader.releaseLock();
        }
      } else {
        accept(await partResponse.arrayBuffer());
      }
    }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (loaded !== manifest.size) throw new Error('Incomplete media');
    const file = new Blob(buffers, { type: manifest.type });
    if (file.size !== manifest.size) throw new Error('Unexpected assembled media size');
    return file;
  };
  const hasSource = video => Boolean(
    (video.getAttribute('src') || '').trim() || video.currentSrc ||
    Array.from(video.querySelectorAll('source')).some(source => (source.getAttribute('src') || '').trim())
  );
  const describeWith = (element, id) => {
    const ids = new Set((element.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    ids.add(id);
    element.setAttribute('aria-describedby', Array.from(ids).join(' '));
  };

  const initialize = () => {
    document.querySelectorAll('video[data-children-video]').forEach(video => {
      if (video.dataset.childrenInitialized === 'true') return;
      video.dataset.childrenInitialized = 'true';
      // The visitor may later choose another native playback speed.
      video.defaultPlaybackRate = 1;
      video.playbackRate = 1;
      video.addEventListener('play', () => {
        document.querySelectorAll('video[data-children-video]').forEach(other => {
          if (other !== video && !other.paused) other.pause();
        });
      });
      // Existing native sources and controls remain as authored in the page.
      const reference = (video.dataset.childrenManifest || '').trim();
      if (!reference || hasSource(video)) return;

      const lang = languageFor(video);
      const copy = messages[lang];
      const formatBytes = bytes => {
        const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
        if (bytes >= 1024 * 1024) return `${number.format(bytes / (1024 * 1024))} MB`;
        if (bytes >= 1024) return `${number.format(bytes / 1024)} KB`;
        return `${bytes} B`;
      };
      if (!video.id) {
        do { video.id = `children-video-${++nextId}`; } while (document.getElementById(video.id) !== video);
      }
      const controls = document.createElement('div');
      controls.className = 'children-media-controls notranslate';
      controls.setAttribute('translate', 'no');
      controls.lang = lang;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button secondary children-media-load';
      button.textContent = copy.load;
      button.setAttribute('aria-controls', video.id);
      const status = document.createElement('p');
      status.className = 'small-note children-media-status';
      do { status.id = `children-media-status-${++nextId}`; } while (document.getElementById(status.id));
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
      status.textContent = copy.initial;
      controls.append(button, status);
      video.after(controls);
      describeWith(video, status.id);
      describeWith(button, status.id);
      video.controls = false;
      video.autoplay = false;
      video.preload = 'none';
      let controller = null;
      let ready = false;
      let lastPercent = -1;

      button.addEventListener('click', async () => {
        if (controller) {
          controller.abort();
          return;
        }
        if (ready) return;
        const request = new AbortController();
        controller = request;
        pending.add(request);
        lastPercent = -1;
        button.textContent = copy.cancel;
        status.textContent = copy.preparing;
        video.setAttribute('aria-busy', 'true');
        let url = null;
        try {
          const file = await prepareVideo(reference, (loaded, total) => {
            const percent = Math.floor(loaded / total * 100);
            if (percent !== lastPercent) {
              lastPercent = percent;
              status.textContent = copy.progress(percent, formatBytes(loaded), formatBytes(total));
            }
          }, request.signal);
          if (request.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          url = URL.createObjectURL(file);
          // Setting src retains the original <track> elements and their default attributes.
          video.src = url;
          video.controls = true;
          video.preload = 'metadata';
          video.load();
          video.defaultPlaybackRate = 1;
          video.playbackRate = 1;
          objectUrls.add(url);
          ready = true;
          button.hidden = true;
          status.textContent = copy.ready;
        } catch (error) {
          if (url) URL.revokeObjectURL(url);
          button.textContent = copy.retry;
          status.textContent = request.signal.aborted || error.name === 'AbortError' ? copy.cancelled : copy.error;
        } finally {
          pending.delete(request);
          if (controller === request) controller = null;
          video.removeAttribute('aria-busy');
        }
      });
    });
  };

  window.addEventListener('pagehide', event => {
    pending.forEach(request => request.abort());
    // Keep usable sources when this document enters the browser's back/forward cache.
    if (!event.persisted) {
      objectUrls.forEach(url => URL.revokeObjectURL(url));
      objectUrls.clear();
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
