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
