const toggle = document.querySelector('.top__toggle')
const nav = document.querySelector('.top__nav')
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true'
  toggle.setAttribute('aria-expanded', String(!open))
  nav.classList.toggle('open')
})
