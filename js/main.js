/**
 * main.js - Основной скрипт для лендинга "Таинственная Сива"
 * Включает: Аккордеон, Плавную прокрутку, Эффект шапки, Подсветку активной секции,
 *           Обработку формы EmailJS, Анимации появления, Аналитику мессенджеров,
 *           Мобильное бургер-меню
 * (Слайдер вынесен в отдельный модуль: js/slider.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // Проверка системных настроек анимации
  // Используется ТОЛЬКО для решения о плавной прокрутке.
  // Анимации появления НЕ отключаются в JS — ими управляет CSS через @media (prefers-reduced-motion).
  // Это нужно, чтобы браузер Brave и другие с агрессивной защитой не блокировали функциональность.
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  /* ==========================================================================
     1. АККОРДЕОН ПРОГРАММЫ (Только один открытый элемент)
     ========================================================================== */
  const accordionHeaders = document.querySelectorAll('.accordion-header');

  if (accordionHeaders.length > 0) {
    accordionHeaders.forEach(header => {
      header.addEventListener('click', function() {
        const currentItem = this.parentElement;
        const isActive = currentItem.classList.contains('active');

        // Закрываем все открытые элементы
        document.querySelectorAll('.accordion-item').forEach(item => {
          item.classList.remove('active');
        });

        // Если кликнули по закрытому — открываем его
        if (!isActive) {
          currentItem.classList.add('active');
          
          // Прокрутка к открытому элементу (с учётом системных настроек)
          setTimeout(() => {
            const offsetTop = currentItem.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ 
              top: offsetTop, 
              behavior: prefersReducedMotion ? 'auto' : 'smooth' 
            });
          }, 100);
        }
      });
      
      // Доступность: клавиатура Enter/Space
      header.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.click();
        }
      });
    });
  }

  /* ==========================================================================
     2. ПЛАВНАЯ ПРОКРУТКА ПО ЯКОРЯМ (SMOOTH SCROLL)
     ========================================================================== */
  const anchorLinks = document.querySelectorAll('a[href^="#"]');
  
  anchorLinks.forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      const targetId = href.substring(1);
      if (!targetId) return; // Игнорируем пустые якоря "#"
      
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        e.preventDefault(); 
        
        // -70px для точной компенсации высоты фиксированной шапки + небольшой отступ
        const offsetTop = targetElement.getBoundingClientRect().top + window.scrollY - 70; 
        
        window.scrollTo({
          top: offsetTop,
          behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
        
        // Обновляем URL для истории браузера
        if (history.pushState) {
          history.pushState(null, null, `#${targetId}`);
        }
      }
    });
  });

  /* ==========================================================================
     3. ЭФФЕКТ ШАПКИ ПРИ СКРОЛЛЕ (Полупрозрачная → Непрозрачная)
     ========================================================================== */
  const header = document.querySelector('.site-header');
  
  if (header) {
    let lastScrollY = 0;
    let ticking = false;

    const updateHeader = () => {
      if (lastScrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      lastScrollY = window.scrollY;
      
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });
  }

  /* ==========================================================================
     4. ПОДСВЕТКА АКТИВНОЙ СЕКЦИИ В МЕНЮ (Лёгкий эффект)
     Требует в header.tmpl атрибуты data-section у ссылок:
     <a href="index.html#about" data-section="about">О туре</a>
     ========================================================================== */
  const navLinks = document.querySelectorAll('.main-nav a[data-section]');
  const sections = document.querySelectorAll('section[id]');

  if (navLinks.length > 0 && sections.length > 0 && 'IntersectionObserver' in window) {
    const observerOptions = {
      rootMargin: '-100px 0px -60% 0px', // Активируем когда секция в верхней трети экрана
      threshold: 0
    };

    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const activeId = entry.target.id;
          
          // Убираем active со всех ссылок
          navLinks.forEach(link => link.classList.remove('active'));
          
          // Добавляем active к соответствующей ссылке
          const activeLink = document.querySelector(`.main-nav a[data-section="${activeId}"]`);
          if (activeLink) {
            activeLink.classList.add('active');
          }
        }
      });
    }, observerOptions);

    // Наблюдаем за всеми секциями
    sections.forEach(section => navObserver.observe(section));
  }

  /* ==========================================================================
     5. ОБРАБОТКА ФОРМЫ ЗАЯВКИ (EMAILJS С ВАЛИДАЦИЕЙ)
     ========================================================================== */
  const bookingForm = document.getElementById('bookingForm');
  
  if (bookingForm && typeof emailjs !== 'undefined') {
    bookingForm.addEventListener('submit', function(e) {
      e.preventDefault(); 
      
      const submitBtn = document.getElementById('submitBtn');
      const successMessage = document.getElementById('successMessage');
      
      if (!submitBtn || !successMessage) {
        console.error('Не найдены элементы формы: submitBtn или successMessage');
        return;
      }
      
      // Читаем конфигурацию из data-атрибутов
      const serviceId = bookingForm.dataset.service;
      const templateId = bookingForm.dataset.template;
      const targetEmail = bookingForm.dataset.email;
      
      if (!serviceId || !templateId || !targetEmail) {
        console.error('Отсутствуют data-атрибуты конфигурации EmailJS');
        showError('Ошибка конфигурации формы. Пожалуйста, свяжитесь с нами через Telegram или WhatsApp.');
        return;
      }
      
      const nameInput = document.getElementById('name');
      const phoneInput = document.getElementById('phone');
      const messageInput = document.getElementById('message');
      
      if (!nameInput || !phoneInput || !messageInput) {
        console.error('Не найдены поля формы');
        return;
      }
      
      // Валидация полей
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const message = messageInput.value.trim();
      
      if (!name) {
        showError('Пожалуйста, введите ваше имя');
        nameInput.focus();
        return;
      }
      
      if (!phone) {
        showError('Пожалуйста, введите телефон или email');
        phoneInput.focus();
        return;
      }
      
      // Блокируем кнопку
      const originalBtnText = submitBtn.innerText;
      submitBtn.innerText = 'Отправка...';
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.7';
      
      const templateParams = {
        from_name: name,
        from_contact: phone,
        message: message,
        to_email: targetEmail
      };
      
      emailjs.send(serviceId, templateId, templateParams)
        .then(function(response) {
          console.log('SUCCESS!', response.status, response.text);
          bookingForm.reset();
          submitBtn.style.display = 'none';
          successMessage.style.display = 'block';
          
          // Автоматически скрываем сообщение через 8 секунд
          setTimeout(() => {
            successMessage.style.display = 'none';
            submitBtn.style.display = 'block';
            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
          }, 8000);
        })
        .catch(function(error) {
          console.error('FAILED...', error);
          showError('Произошла ошибка при отправке. Пожалуйста, свяжитесь с нами через Telegram или WhatsApp.');
          submitBtn.innerText = originalBtnText;
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
        });
    });
  }

  function showError(message) {
    alert(message);
  }

  /* ==========================================================================
     6. АНИМАЦИЯ ПОЯВЛЕНИЯ ЭЛЕМЕНТОВ ПРИ СКРОЛЛЕ
     
     ВАЖНО: НЕ отключаем через prefers-reduced-motion в JS!
     Управление для пользователей с отключёнными анимациями происходит в CSS:
     
     .fade-in { opacity: 0; transform: translateY(20px); transition: ... }
     .fade-in.visible { opacity: 1; transform: translateY(0); }
     
     @media (prefers-reduced-motion: reduce) {
       .fade-in { opacity: 1; transform: none; transition: none; }
     }
     
     Это позволяет:
     1. Анимации работать во всех браузерах (включая Brave с Shields)
     2. CSS корректно отключать анимацию для пользователей с reduce-motion
     ========================================================================== */
  if ('IntersectionObserver' in window) {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // Отписываемся после первого появления
        }
      });
    }, observerOptions);

    // Наблюдаем за секциями
    document.querySelectorAll('.section').forEach(section => {
      section.classList.add('fade-in');
      observer.observe(section);
    });
  }

  /* ==========================================================================
     7. ОБРАБОТКА ССЫЛОК В МЕСЕНДЖЕРЫ (АНАЛИТИКА)
     ========================================================================== */
  const messengerButtons = document.querySelectorAll('.messenger-btn');
  
  messengerButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      const platform = this.classList.contains('telegram') ? 'Telegram' :
                       this.classList.contains('whatsapp') ? 'WhatsApp' :
                       this.classList.contains('instagram') ? 'Instagram' : 'Unknown';
      
      // Логируем клик (для отладки)
      console.log(`Клик по ${platform}`);
      
      // Интеграция с Google Analytics 4 (раскомментируйте при подключении GA)
      // if (typeof gtag !== 'undefined') {
      //   gtag('event', 'contact_click', { 
      //     platform: platform,
      //     event_category: 'engagement',
      //     event_label: `Contact via ${platform}`
      //   });
      // }
      
      // Интеграция с Яндекс.Метрикой (раскомментируйте при подключении)
      // if (typeof ym !== 'undefined') {
      //   ym(XXXXXXXX, 'reachGoal', 'contact_click', { platform: platform });
      // }
    });
  });

  /* ==========================================================================
     8. АВТОМАТИЧЕСКАЯ ПОДСТАНОВКА ТЕКУЩЕГО ГОДА В ФУТЕРЕ
     ========================================================================== */
  const copyrightElement = document.querySelector('.footer-copyright p');
  if (copyrightElement) {
    const currentYear = new Date().getFullYear();
    copyrightElement.innerHTML = copyrightElement.innerHTML.replace(/20\d{2}/, currentYear);
  }

  /* ==========================================================================
     9. ОБРАБОТКА ОШИБОК ГЛОБАЛЬНО
     ========================================================================== */
  window.addEventListener('error', function(e) {
    console.error('Глобальная ошибка:', e.message, 'в', e.filename, 'строка', e.lineno);
    // Можно добавить отправку ошибки в систему мониторинга (Sentry, LogRocket и т.д.)
  });

  window.addEventListener('unhandledrejection', function(e) {
    console.error('Необработанный Promise rejection:', e.reason);
    // Можно добавить отправку ошибки в систему мониторинга
  });

  /* ==========================================================================
     10. МОБИЛЬНОЕ МЕНЮ (БУРГЕР)
     
     Доступное бургер-меню с полной поддержкой клавиатуры и скринридеров.
     Открывается/закрывается по клику, Escape, клику вне меню и ресайзу.
     Блокирует прокрутку страницы при открытом меню.
     ========================================================================== */
  const burgerBtn = document.getElementById('burgerBtn');
  const mainNav = document.getElementById('mainNav');

  if (burgerBtn && mainNav) {
    const closeMenu = () => {
      mainNav.classList.remove('open');
      burgerBtn.classList.remove('active');
      burgerBtn.setAttribute('aria-expanded', 'false');
      burgerBtn.setAttribute('aria-label', 'Открыть меню');
      document.body.classList.remove('menu-open');
    };

    const openMenu = () => {
      mainNav.classList.add('open');
      burgerBtn.classList.add('active');
      burgerBtn.setAttribute('aria-expanded', 'true');
      burgerBtn.setAttribute('aria-label', 'Закрыть меню');
      document.body.classList.add('menu-open');
    };

    // Переключение по клику на бургер
    burgerBtn.addEventListener('click', () => {
      if (mainNav.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Закрытие после клика по любому пункту меню
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        closeMenu();
      });
    });

    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mainNav.classList.contains('open')) {
        closeMenu();
        burgerBtn.focus(); // Возвращаем фокус на кнопку (доступность)
      }
    });

    // Закрытие по клику вне меню
    document.addEventListener('click', (e) => {
      if (mainNav.classList.contains('open') &&
          !mainNav.contains(e.target) &&
          !burgerBtn.contains(e.target)) {
        closeMenu();
      }
    });

    // Закрытие при ресайзе на десктоп (если меню было открыто)
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768 && mainNav.classList.contains('open')) {
        closeMenu();
      }
    });
  }


  /* ==========================================================================
     11. КНОПКА "НАВЕРХ" (SCROLL TO TOP)
     
     Появляется после скролла на 500px вниз.
     Плавно возвращает наверх при клике.
     Скрывается/показывается с анимацией.
     Учитывает prefers-reduced-motion для доступности.
     ========================================================================== */
  
  // Создаём кнопку динамически (не нужно добавлять в HTML)
  const scrollTopBtn = document.createElement('button');
  scrollTopBtn.className = 'scroll-top-btn';
  scrollTopBtn.setAttribute('aria-label', 'Наверх');
  scrollTopBtn.setAttribute('type', 'button');
  scrollTopBtn.innerHTML = '↑';
  document.body.appendChild(scrollTopBtn);
  
  // Отслеживаем скролл с throttle для производительности
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    if (scrollTimeout) return;
    
    scrollTimeout = setTimeout(() => {
      if (window.scrollY > 500) {
        scrollTopBtn.classList.add('visible');
      } else {
        scrollTopBtn.classList.remove('visible');
      }
      scrollTimeout = null;
    }, 100);
  }, { passive: true });
  
  // Клик — плавная прокрутка наверх
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  });

});