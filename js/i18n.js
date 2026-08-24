/* ==========================================================================
   I18N: АВТООПРЕДЕЛЕНИЕ ЯЗЫКА И ЗАПОМИНАНИЕ ВЫБОРА
   
   - При первом заходе: определяем язык по navigator.language
   - После клика на RU/EN: запоминаем выбор в localStorage
   - При следующем заходе: редиректим на сохранённую версию
   
   Работает корректно и на file:// (локально), и на веб-сервере.
   ========================================================================== */
(function() {
  const STORAGE_KEY = 'preferredLang';
  const pathname = window.location.pathname;
  const isEnVersion = /\/en(?:\/|$)/.test(pathname);
  const detectedLang = isEnVersion ? 'en' : 'ru';
  
  /**
   * Строит URL для перехода на другой язык, сохраняя текущую страницу.
   */
  function buildTargetUrl(targetLang) {
    const hash = window.location.hash;
    
    if (targetLang === 'en' && !isEnVersion) {
      if (pathname.includes('/articles/')) {
        return pathname.replace('/articles/', '/en/articles/') + hash;
      }
      if (pathname.endsWith('/index.html')) {
        return pathname.replace('/index.html', '/en/index.html') + hash;
      }
      if (pathname.endsWith('/')) {
        return pathname + 'en/index.html' + hash;
      }
      const lastSlash = pathname.lastIndexOf('/');
      return pathname.substring(0, lastSlash + 1) + 'en/' + pathname.substring(lastSlash + 1) + hash;
    }
    
    if (targetLang === 'ru' && isEnVersion) {
      return pathname.replace('/en/', '/') + hash;
    }
    
    return pathname + hash;
  }
  
  // === АВТО-РЕДИРЕКТ ПО СОХРАНЁННОМУ ПРЕДПОЧТЕНИЮ ===
  const savedLang = localStorage.getItem(STORAGE_KEY);
  
  if (savedLang && savedLang !== detectedLang) {
    window.location.replace(buildTargetUrl(savedLang));
    return;
  }
  
  // === ПЕРВЫЙ ВИЗИТ: определяем язык по браузеру ===
  if (!savedLang) {
    const browserLang = (navigator.language || navigator.userLanguage || 'ru')
      .substring(0, 2).toLowerCase();
    const preferredLang = browserLang === 'en' ? 'en' : 'ru';
    localStorage.setItem(STORAGE_KEY, preferredLang);
    
    if (preferredLang !== detectedLang) {
      window.location.replace(buildTargetUrl(preferredLang));
      return;
    }
  }
  
  // === DROPDOWN: раскрытие/закрытие ===
  const langSwitch = document.querySelector('.lang-switch');
  const langToggle = document.querySelector('.lang-toggle');
  
  if (langSwitch && langToggle) {
    // Клик на кнопке — toggle
    langToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = langSwitch.classList.toggle('is-open');
      langToggle.setAttribute('aria-expanded', isOpen);
    });
    
    // Клик вне dropdown — закрытие
    document.addEventListener('click', (e) => {
      if (!langSwitch.contains(e.target)) {
        langSwitch.classList.remove('is-open');
        langToggle.setAttribute('aria-expanded', 'false');
      }
    });
    
    // Escape — закрытие
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && langSwitch.classList.contains('is-open')) {
        langSwitch.classList.remove('is-open');
        langToggle.setAttribute('aria-expanded', 'false');
        langToggle.focus();
      }
    });
  }
  
  // === КЛИКИ НА ЯЗЫКИ В DROPDOWN ===
  document.querySelectorAll('.lang-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetLang = link.getAttribute('data-lang');
      if (targetLang) {
        localStorage.setItem(STORAGE_KEY, targetLang);
      }
    });
  });
})();