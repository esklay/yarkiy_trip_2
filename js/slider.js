/* ==========================================================================
   УНИВЕРСАЛЬНЫЙ МОДУЛЬ СЛАЙДЕРА
   
   Работает с любым количеством слайдеров на странице.
   Инициализируется на контейнерах .hero-slider, .guide-slider и .article-slider.
   
   HERO-слайдер:    автопрокрутка 5 сек.
   GUIDE-слайдер:   автопрокрутка 6 сек (фото рассматривают дольше).
   ARTICLE-слайдер: БЕЗ автопрокрутки (пользователь читает статью).
   
   Общие правила:
   - Автопрокрутка идёт ТОЛЬКО пока слайдер виден в viewport (≥50%)
     и останавливается при наведении мыши / касании.
   - Глобальные стрелки ←/→ листают слайдер любого типа (hero, guide,
     article), ТОЛЬКО если он сейчас виден на экране (this.isVisible).
     При фокусе в полях формы (input/textarea) стрелки не перехватываются.
   - ARIA, prefers-reduced-motion, touch-свайпы с проверкой направления,
     защита от кликов во время анимации, debounce resize, hover стрелок.
   ========================================================================== */

// Предзагрузка hover-изображений стрелок (для плавного эффекта)
(function preloadSliderImages() {
  const hoverImages = [
    'images/slideshow_arrow_left2.png',
    'images/slideshow_arrow_right2.png'
  ];
  hoverImages.forEach(src => {
    const img = new Image();
    img.src = src;
  });
})();

class Slider {
  constructor(container) {
    try {
      this.container = container;
      
      // Определяем тип слайдера
      this.isHero = container.classList.contains('hero-slider');
      this.isGuide = container.classList.contains('guide-slider');
      // article-slider не нуждается в отдельном флаге: он обрабатывается как "прочее"
      
      this.track = container.querySelector('.slider-track');
      if (!this.track) {
        console.warn('Slider: трек не найден в', container);
        return;
      }
      
      this.slides = this.track.querySelectorAll('.slide');
      if (this.slides.length === 0) {
        console.warn('Slider: слайды не найдены в', container);
        return;
      }
      
      this.totalSlides = this.slides.length;
      this.currentIndex = 0;
      this.isPaused = false;
      this.isAnimating = false;
      this.isVisible = false; // На экране ли слайдер (для автоплея и стрелок)
      this.autoPlayTimer = null;
      
      // Проверка системных настроек анимации
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      // Автопрокрутка: hero — 5 сек, guide — 6 сек, остальные (article) — 0
      if (this.prefersReducedMotion) {
        this.autoPlayInterval = 0;
      } else if (this.isHero) {
        this.autoPlayInterval = 5000;
      } else if (this.isGuide) {
        this.autoPlayInterval = 6000;
      } else {
        this.autoPlayInterval = 0;
      }
      
      this.dotsContainer = container.querySelector('.slider-dots');
      this.prevBtn = container.querySelector('.slider-btn-prev');
      this.nextBtn = container.querySelector('.slider-btn-next');
      
      this.init();
    } catch (error) {
      console.error('Ошибка инициализации слайдера:', error);
    }
  }
  
  init() {
    // ARIA-атрибуты для доступности
    this.track.setAttribute('aria-live', 'polite');
    this.track.setAttribute('aria-atomic', 'true');
    
    this.createDots();
    
    // --- Кнопка "Назад" ---
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => {
        if (this.isAnimating) return;
        this.prev();
        this.resetAutoPlay();
      });
      
      const prevImg = this.prevBtn.querySelector('img');
      if (prevImg) {
        this.prevBtn.addEventListener('mouseenter', () => {
          prevImg.src = 'images/slideshow_arrow_left2.png';
        });
        this.prevBtn.addEventListener('mouseleave', () => {
          prevImg.src = 'images/slideshow_arrow_left.png';
        });
      }
    }
    
    // --- Кнопка "Вперёд" ---
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => {
        if (this.isAnimating) return;
        this.next();
        this.resetAutoPlay();
      });
      
      const nextImg = this.nextBtn.querySelector('img');
      if (nextImg) {
        this.nextBtn.addEventListener('mouseenter', () => {
          nextImg.src = 'images/slideshow_arrow_right2.png';
        });
        this.nextBtn.addEventListener('mouseleave', () => {
          nextImg.src = 'images/slideshow_arrow_right.png';
        });
      }
    }
    
    // Пауза при наведении мыши на весь слайдер
    this.container.addEventListener('mouseenter', () => this.pause());
    this.container.addEventListener('mouseleave', () => this.resume());
    
    // Глобальная клавиатурная навигация для ВСЕХ типов слайдеров.
    // Стрелки ←/→ листают только тот слайдер, который сейчас виден
    // на экране (this.isVisible через IntersectionObserver ≥50%):
    // - в статье слайдер отвечает, когда доехали до него скроллом;
    // - на главной hero/guide отвечают, пока находятся в кадре.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (!this.isVisible || this.isAnimating) return;
      
      // Не перехватываем стрелки, когда пользователь печатает в форме
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
                t.tagName === 'SELECT' || t.isContentEditable)) {
        return;
      }
      
      if (e.key === 'ArrowLeft') {
        this.prev();
      } else {
        this.next();
      }
      this.resetAutoPlay();
    });
    
    // Поддержка свайпов для мобильных устройств
    this.addTouchSupport();
    
    // IntersectionObserver: автоплей и флаг видимости для стрелок
    this.setupViewportObserver();
    
    // Debounce для resize
    this.setupResizeHandler();
    
    // Запуск автоплея (observer сразу скорректирует, если слайдер вне экрана)
    if (this.autoPlayInterval > 0) {
      this.startAutoPlay();
    }
  }
  
  setupViewportObserver() {
    if (!('IntersectionObserver' in window)) {
      // Без observer считаем слайдер видимым (стрелки и автоплей работают)
      this.isVisible = true;
      return;
    }
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        this.isVisible = entry.isIntersecting;
        
        if (entry.isIntersecting) {
          if (!this.isPaused && this.autoPlayInterval > 0) {
            this.startAutoPlay();
          }
        } else {
          this.stopAutoPlay();
        }
      });
    }, {
      threshold: 0.5, // Слайдер считается видимым, когда показан ≥50%
      rootMargin: '0px'
    });
    
    observer.observe(this.container);
  }
  
  setupResizeHandler() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleResize();
      }, 250);
    });
  }
  
  handleResize() {
    this.update();
  }
  
  createDots() {
    if (!this.dotsContainer) return;
    
    for (let i = 0; i < this.totalSlides; i++) {
      const dot = document.createElement('button');
      dot.classList.add('slider-dot');
      if (i === 0) dot.classList.add('active');
      dot.setAttribute('aria-label', `Перейти к слайду ${i + 1}`);
      dot.setAttribute('type', 'button');
      
      dot.addEventListener('click', () => {
        if (this.isAnimating) return;
        this.goTo(i);
        this.resetAutoPlay();
      });
      
      this.dotsContainer.appendChild(dot);
    }
    
    this.dots = this.dotsContainer.querySelectorAll('.slider-dot');
  }
  
  update() {
    this.isAnimating = true;
    
    if (this.prefersReducedMotion) {
      this.track.style.transition = 'none';
    } else {
      this.track.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    }
    
    this.track.style.transform = `translateX(-${this.currentIndex * 100}%)`;
    
    if (this.dots) {
      this.dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === this.currentIndex);
      });
    }
    
    const transitionDuration = this.prefersReducedMotion ? 0 : 600;
    setTimeout(() => {
      this.isAnimating = false;
    }, transitionDuration);
  }
  
  next() {
    this.currentIndex = (this.currentIndex + 1) % this.totalSlides;
    this.update();
  }
  
  prev() {
    this.currentIndex = (this.currentIndex - 1 + this.totalSlides) % this.totalSlides;
    this.update();
  }
  
  goTo(index) {
    if (index < 0 || index >= this.totalSlides) return;
    this.currentIndex = index;
    this.update();
  }
  
  startAutoPlay() {
    if (this.autoPlayInterval === 0) return;
    
    this.stopAutoPlay();
    this.autoPlayTimer = setInterval(() => {
      if (!this.isPaused && !this.isAnimating) {
        this.next();
      }
    }, this.autoPlayInterval);
  }
  
  stopAutoPlay() {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }
  
  pause() {
    this.isPaused = true;
  }
  
  resume() {
    this.isPaused = false;
    // Если слайдер виден — возобновляем автопрокрутку после снятия паузы
    if (this.isVisible && this.autoPlayInterval > 0) {
      this.startAutoPlay();
    }
  }
  
  resetAutoPlay() {
    this.stopAutoPlay();
    this.startAutoPlay();
  }
  
  addTouchSupport() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    
    this.container.addEventListener('touchstart', (e) => {
      if (this.isAnimating) return;
      
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
      this.pause();
    }, { passive: true });
    
    this.container.addEventListener('touchend', (e) => {
      if (this.isAnimating) return;
      
      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
      
      this.handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
      this.resume();
    }, { passive: true });
  }
  
  handleSwipe(startX, startY, endX, endY) {
    const swipeThreshold = 50;
    const diffX = startX - endX;
    const diffY = startY - endY;
    
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > swipeThreshold) {
        if (diffX > 0) {
          this.next();
        } else {
          this.prev();
        }
        this.resetAutoPlay();
      }
    }
  }
}

// Инициализация всех слайдеров на странице при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.hero-slider, .guide-slider, .article-slider').forEach(container => {
    new Slider(container);
  });
});