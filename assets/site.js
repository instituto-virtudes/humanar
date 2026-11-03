(() => {
  const menu = document.querySelector('.menu-button');
  const nav = document.getElementById('navegacao');
  if (menu && nav) {
    const closeMenu = () => { menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); };
    menu.addEventListener('click', () => {
      const isOpen = menu.getAttribute('aria-expanded') === 'true';
      menu.setAttribute('aria-expanded', String(!isOpen));
      nav.classList.toggle('is-open', !isOpen);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); menu.focus(); } });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
    matchMedia('(min-width: 1101px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });
  }
  const viewer = document.querySelector('[data-slides]');
  if (!viewer) return;
  const prev = document.getElementById('slide-prev');
  const next = document.getElementById('slide-next');
  const number = document.getElementById('slide-number');
  const img = document.getElementById('slide-image');
  const content = document.getElementById('slide-text');
  const status = document.getElementById('slide-status');
  const error = document.getElementById('viewer-error');
  let slides = [], index = 0;
  const requested = () => Number(new URLSearchParams(location.hash.slice(1)).get('pagina') || 1) - 1;
  const show = (i, setHash = true) => {
    index = Math.max(0, Math.min(slides.length - 1, Number.isFinite(i) ? i : 0));
    img.src = slides[index].image;
    img.alt = `Página ${index + 1} da apresentação do Humanar`;
    number.value = index + 1;
    content.textContent = slides[index].text;
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    status.textContent = `Página ${index + 1} de ${slides.length}`;
    if (setHash) history.replaceState(null, '', `#pagina=${index + 1}`);
    if (index + 1 < slides.length) { const preload = new Image(); preload.src = slides[index + 1].image; }
  };
  prev.disabled = true; next.disabled = true;
  fetch(viewer.dataset.slides).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(data => {
    slides = data; show(requested(), false);
    prev.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));
    number.addEventListener('change', () => show(Number(number.value) - 1));
    viewer.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => show(Number(button.dataset.page) - 1)));
    window.addEventListener('hashchange', () => show(requested(), false));
    viewer.addEventListener('keydown', (event) => {
      if (event.target.matches('input')) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
    });
  }).catch(() => { error.hidden = false; error.textContent = 'Não foi possível carregar a apresentação. Recarregue a página ou baixe o arquivo abaixo.'; });
})();

/* Submenus: acesso por mouse, toque e teclado em todas as páginas. */
(() => {
 const groups=[...document.querySelectorAll('.nav-item')].filter(item=>item.querySelector('.nav-toggle'));
 const set=(item,open)=>{const button=item.querySelector('.nav-toggle');button.setAttribute('aria-expanded',String(open));document.getElementById(button.getAttribute('aria-controls')).hidden=!open;};
 const closeOthers=except=>groups.forEach(item=>{if(item!==except)set(item,false)});
 groups.forEach(item=>{
  const button=item.querySelector('.nav-toggle');let leaveTimer;
  button.addEventListener('click',()=>{clearTimeout(leaveTimer);const open=button.getAttribute('aria-expanded')!=='true';closeOthers(item);set(item,open)});
  button.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();closeOthers(item);set(item,true);item.querySelector('.nav-submenu a').focus()}});
  item.querySelector('.nav-parent>a').addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&item.closest('.nav')&&matchMedia('(min-width:1101px)').matches){clearTimeout(leaveTimer);closeOthers(item);set(item,true)}});
  item.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&item.closest('.nav'))leaveTimer=setTimeout(()=>{if(!item.contains(document.activeElement))set(item,false)},150)});
  item.addEventListener('focusout',()=>setTimeout(()=>{if(!item.contains(document.activeElement))set(item,false)},0));
  item.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();set(item,false);button.focus()}});
  item.querySelectorAll('.nav-submenu a').forEach(a=>a.addEventListener('click',()=>set(item,false)));
 });
 document.addEventListener('click',e=>{if(!e.target.closest('.nav-item'))closeOthers()});
 document.querySelector('.menu-button')?.addEventListener('click',()=>{if(document.querySelector('.menu-button').getAttribute('aria-expanded')==='false')closeOthers()});
})();

/* Faixa contínua de parceiros, com pausa e navegação manual. */
(() => {
 const track=document.getElementById('parceiros-faixa');if(!track)return;
 const section=track.closest('.partners-section'),prev=section.querySelector('[data-partners-prev]'),next=section.querySelector('[data-partners-next]'),pause=section.querySelector('[data-partners-pause]');
 const count=track.children.length;track.dataset.partnerCount=count;
 [...track.children].slice(0,4).forEach(item=>{const clone=item.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.inert=true;clone.dataset.carouselClone='true';clone.querySelector('a').removeAttribute('href');clone.querySelector('img').alt='';track.append(clone)});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let userPaused=reduced.matches,hover=false,focused=false,visible=false,touching=false,timer,settled;
 const stride=()=>track.firstElementChild.getBoundingClientRect().width+(parseFloat(getComputedStyle(track).gap)||0);
 const span=()=>stride()*count;
 const instant=left=>track.scrollTo({left,behavior:'instant'});
 const normalize=()=>{if(track.scrollLeft>=span()-1)instant(track.scrollLeft-span())};
 const renderPause=()=>{pause.setAttribute('aria-pressed',String(userPaused));pause.setAttribute('aria-label',userPaused?'Retomar avanço automático dos parceiros':'Pausar avanço automático dos parceiros');pause.innerHTML='<span aria-hidden="true">'+(userPaused?'▶':'Ⅱ')+'</span>'};
 const move=direction=>{clearTimeout(settled);normalize();const behavior=reduced.matches?'instant':'smooth';if(direction<0&&track.scrollLeft<2){instant(span());requestAnimationFrame(()=>track.scrollTo({left:span()-stride(),behavior}));}else track.scrollTo({left:track.scrollLeft+direction*stride(),behavior});};
 const schedule=()=>{clearTimeout(timer);track.dataset.autoplay=String(!userPaused&&!hover&&!focused&&!touching&&visible&&!document.hidden);if(track.dataset.autoplay==='true')timer=setTimeout(()=>{move(1);schedule()},4200)};
 prev.addEventListener('click',()=>{move(-1);schedule()});next.addEventListener('click',()=>{move(1);schedule()});
 pause.addEventListener('click',()=>{userPaused=!userPaused;renderPause();schedule()});
 track.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);schedule()}});
 track.addEventListener('scroll',()=>{clearTimeout(settled);settled=setTimeout(normalize,180)},{passive:true});
 section.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){hover=true;schedule()}});section.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){hover=false;schedule()}});
 section.addEventListener('focusin',()=>{focused=true;schedule()});section.addEventListener('focusout',()=>setTimeout(()=>{focused=section.contains(document.activeElement);schedule()},0));
 track.addEventListener('pointerdown',()=>{touching=true;schedule()},{passive:true});window.addEventListener('pointerup',()=>{touching=false;schedule()},{passive:true});
 document.addEventListener('visibilitychange',schedule);window.addEventListener('resize',()=>{instant(0);schedule()});reduced.addEventListener('change',()=>{userPaused=reduced.matches;renderPause();schedule()});
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule()},{threshold:.3}).observe(section);
 renderPause();schedule();
})();
