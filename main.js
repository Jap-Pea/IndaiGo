document.addEventListener('DOMContentLoaded', () => {
  /* ========= Nav toggle ========= */
  const toggle = document.querySelector('.top__toggle')
  const nav = document.querySelector('.top__nav')

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true'
      toggle.setAttribute('aria-expanded', String(!open))
      nav.classList.toggle('open')
    })
  }

  /* ========= Lightbox ========= */
  const lightbox = document.getElementById('lightbox')
  const lightboxImg = document.getElementById('lightbox-img')
  const captionText = document.getElementById('lightbox-caption')
  const closeBtn = lightbox ? lightbox.querySelector('.close') : null

  // Remember last focused element to restore focus on close
  let lastFocus = null

  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImg) return
    lastFocus = document.activeElement
    lightboxImg.src = src
    lightboxImg.alt = alt || ''
    if (captionText) captionText.textContent = alt || ''
    lightbox.classList.add('open')
    lightbox.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden' // prevent background scroll
    // Move focus to close button for accessibility
    if (closeBtn) closeBtn.focus({ preventScroll: true })
  }

  function closeLightbox() {
    if (!lightbox) return
    lightbox.classList.remove('open')
    lightbox.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = '' // restore scroll
    // Return focus
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus({ preventScroll: true })
    }
  }

  // Open on click
  const gallery = document.querySelector('.gallery')
  if (gallery && lightbox) {
    gallery.addEventListener('click', (e) => {
      const img = e.target.closest('img')
      if (!img) return
      const full = img.getAttribute('data-full') || img.src
      openLightbox(full, img.alt || '')
    })
  }

  // Close handlers
  if (closeBtn) closeBtn.addEventListener('click', closeLightbox)

  if (lightbox) {
    // Click backdrop (not the image)
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox()
    })
  }

  // Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && lightbox.classList.contains('open')) {
      closeLightbox()
    }
  })
})

// ===== UI/UX PAGE SCRIPTS =====
(function () {
  const root = document.querySelector('.uiux');
  if (!root) return; // only run on ui-ux.html

  // --- Filters ---
  const chips = root.querySelectorAll('.uiux__chip');
  const cards = root.querySelectorAll('.uiux__card');
  chips.forEach(ch => {
    ch.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('uiux__chip--active'));
      ch.classList.add('uiux__chip--active');
      const f = ch.dataset.filter;
      cards.forEach(card => {
        const tags = card.dataset.tags || '';
        card.style.display = (f === 'all' || tags.includes(f)) ? '' : 'none';
      });
    });
  });

  // --- Lightbox ---
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightboxImg');
  const closeBtn = document.getElementById('closeLightbox');
  root.querySelectorAll('.uiux__view').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const full = a.dataset.full || a.getAttribute('href');
      if (!full) return;
      lbImg.src = full;
      lb.classList.add('uiux__lightbox--open');
      lb.setAttribute('aria-hidden', 'false');
    });
  });
  function closeLB() {
    lb.classList.remove('uiux__lightbox--open');
    lb.setAttribute('aria-hidden', 'true');
    lbImg.removeAttribute('src');
  }
  closeBtn.addEventListener('click', closeLB);
  lb.addEventListener('click', e => { if (e.target === lb) closeLB(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeLB(); });

  // --- Before/After slider ---
  function makeBA(id) {
    const root = document.getElementById(id);
    if (!root) return;
    const after = root.querySelector('.uiux__ba-after');
    const handle = root.querySelector('.uiux__ba-handle');
    const knob = root.querySelector('.uiux__ba-knob');
    let pct = 50, dragging = false;

    function setFromX(x) {
      const rect = root.getBoundingClientRect();
      pct = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
      after.style.clipPath = `inset(0 0 0 ${pct}%)`;
      handle.style.left = knob.style.left = pct + '%';
    }

    const onMove = e => {
      if (!dragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      setFromX(clientX);
    };

    root.addEventListener('mousedown', e => { dragging = true; setFromX(e.clientX); });
    root.addEventListener('touchstart', e => { dragging = true; setFromX(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', () => dragging = false);
    window.addEventListener('touchend', () => dragging = false);
    window.addEventListener('touchcancel', () => dragging = false);

    // Keyboard nudge on knob
    knob.addEventListener('keydown', e => {
      const rect = root.getBoundingClientRect();
      if (e.key === 'ArrowLeft')  setFromX(rect.left + (pct - 2) / 100 * rect.width);
      if (e.key === 'ArrowRight') setFromX(rect.left + (pct + 2) / 100 * rect.width);
    });

    // init center
    const rect = root.getBoundingClientRect();
    setFromX(rect.left + rect.width / 2);
  }

  makeBA('ba1');
})();
const lbCaption = document.getElementById('lightboxCaption'); // add this in HTML below
root.querySelectorAll('.uiux__view').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const full = a.dataset.full;
    const cap  = a.dataset.caption || '';
    if (!full) return;
    lbImg.src = full;
    if (lbCaption) lbCaption.textContent = cap;
    lb.classList.add('uiux__lightbox--open');
    lb.setAttribute('aria-hidden','false');
  });
});

// ===== Game Dev page scripts (scoped) =====
(function () {
  // Only run on game-dev.html
  if (!document.querySelector('.gamedev')) return;

  // Lightbox
  const lb = document.getElementById('gdLightbox');
  const full = document.getElementById('gdFull');
  const closeBtn = document.getElementById('gdClose');

  document.querySelectorAll('.gd-shot img').forEach(img => {
    img.addEventListener('click', () => {
      full.src = img.dataset.full || img.src;
      lb.classList.add('open');
      lb.setAttribute('aria-hidden', 'false');
    });
  });

  function closeLB () {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    full.removeAttribute('src');
  }
  closeBtn.addEventListener('click', closeLB);
  lb.addEventListener('click', e => { if (e.target === lb) closeLB(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeLB(); });
})();

// ===== Web Games page scripts (scoped) =====
(function () {
  // Only run on web-games.html
  if (!document.querySelector('.games')) return;

  const modal = document.getElementById('gamesModal');
  const iframe = document.getElementById('gamesIframe');
  const closeBtn = document.getElementById('gamesClose');

  // Open inline game
  document.querySelectorAll('[data-embed]').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-embed');
      if (!url) return;
      iframe.src = url;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    });
  });

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    // Stop the game when closing
    iframe.src = '';
  }

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
})();