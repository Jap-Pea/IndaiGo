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

  /* ========= Index: gallery lightbox ========= */
  ;(function runIndexLightbox() {
    const gallery = document.querySelector('.gallery')
    const lightbox = document.getElementById('lightbox') // <div id="lightbox">
    if (!gallery || !lightbox) return

    const lightboxImg = document.getElementById('lightbox-img') // <img id="lightbox-img">
    const captionText = document.getElementById('lightbox-caption') // <div id="lightbox-caption">
    const closeBtn = lightbox.querySelector('.close')
    let lastFocus = null

    function openLightbox(src, alt) {
      lastFocus = document.activeElement
      lightboxImg.src = src
      lightboxImg.alt = alt || ''
      if (captionText) captionText.textContent = alt || ''
      lightbox.classList.add('open')
      lightbox.setAttribute('aria-hidden', 'false')
      document.body.style.overflow = 'hidden'
      if (closeBtn) closeBtn.focus({ preventScroll: true })
    }

    function closeLightbox() {
      lightbox.classList.remove('open')
      lightbox.setAttribute('aria-hidden', 'true')
      document.body.style.overflow = ''
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true })
      lightboxImg.removeAttribute('src')
    }

    gallery.addEventListener('click', (e) => {
      const img = e.target.closest('img')
      if (!img) return
      const full = img.getAttribute('data-full') || img.src
      openLightbox(full, img.alt || '')
    })

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox)
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox()
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox()
    })
  })()

  /* ========= Game Dev page (game-dev.html) ========= */
  ;(function runGameDev() {
    if (!document.querySelector('.gamedev')) return

    const lb = document.getElementById('gdLightbox')
    const full = document.getElementById('gdFull')
    const closeBtn = document.getElementById('gdClose')
    const shots = Array.from(document.querySelectorAll('.gd-shot img'))

    if (!lb || !full || !shots.length) return

    let index = -1
    let lastFocus = null

    function openLB(i) {
      index = i
      const img = shots[i]
      full.src = img.dataset.full || img.src
      full.alt = img.alt || 'Screenshot'
      lb.classList.add('open')
      lb.setAttribute('aria-hidden', 'false')
      document.body.classList.add('no-scroll')
      lastFocus = document.activeElement
      closeBtn && closeBtn.focus({ preventScroll: true })

      // preload neighbors
      const nextIdx = (i + 1) % shots.length
      const prevIdx = (i - 1 + shots.length) % shots.length
      ;[nextIdx, prevIdx].forEach((idx) => {
        const pre = new Image()
        const s = shots[idx]
        pre.src = s.dataset.full || s.src
      })
    }

    function closeLB() {
      lb.classList.remove('open')
      lb.setAttribute('aria-hidden', 'true')
      document.body.classList.remove('no-scroll')
      full.removeAttribute('src')
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true })
      index = -1
    }

    function next() { if (index >= 0) openLB((index + 1) % shots.length) }
    function prev() { if (index >= 0) openLB((index - 1 + shots.length) % shots.length) }

    shots.forEach((img, i) => {
      img.addEventListener('click', () => openLB(i))
      img.setAttribute('loading', 'lazy')
      img.setAttribute('decoding', 'async')
    })

    if (closeBtn) closeBtn.addEventListener('click', closeLB)
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLB() })
    window.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return
      if (e.key === 'Escape') closeLB()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    })
  })()

  /* ========= Web Games page (web-games.html) ========= */
  ;(function runWebGames() {
    if (!document.querySelector('.games')) return

    const modal = document.getElementById('gamesModal')
    const iframe = document.getElementById('gamesIframe')
    const closeBtn = document.getElementById('gamesClose')
    if (!modal || !iframe) return

    document.querySelectorAll('[data-embed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-embed')
        if (!url) return
        iframe.src = url
        modal.classList.add('open')
        modal.setAttribute('aria-hidden', 'false')
      })
    })

    function closeModal() {
      modal.classList.remove('open')
      modal.setAttribute('aria-hidden', 'true')
      iframe.src = '' // stop game when closing
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal()
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal()
    })
  })()
})
