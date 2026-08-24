/**
 * articles.js - Скрипт для подгрузки превью статей из JSON
 */

document.addEventListener('DOMContentLoaded', () => {
  const articlesGrid = document.getElementById('articles-grid');

  // Если блока для статей нет на странице, прерываем выполнение
  if (!articlesGrid) return;

  // Функция для загрузки и рендеринга статей
  async function loadArticles() {
    try {
      // Имитируем небольшую задержку (опционально, для красоты загрузки)
      // В реальном проекте можно убрать, но это добавляет плавности
      articlesGrid.innerHTML = '<p class="text-center" style="grid-column: 1 / -1;">Загрузка материалов о местах силы...</p>';

      const response = await fetch('data/articles.json');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const articles = await response.json();
      
      // Очищаем контейнер перед добавлением карточек
      articlesGrid.innerHTML = '';

      // Если массив статей пуст
      if (articles.length === 0) {
        articlesGrid.innerHTML = '<p class="text-center" style="grid-column: 1 / -1;">Скоро здесь появятся новые статьи.</p>';
        return;
      }

      // Генерируем HTML для каждой статьи
      articles.forEach(article => {
        const articleCard = `
          <a href="${article.url}" class="article-card">
            <div class="article-date">${article.date}</div>
            <h3 class="article-title">${article.title}</h3>
            <p class="article-excerpt">${article.excerpt}</p>
            <div class="article-read-more">Читать статью &rarr;</div>
          </a>
        `;
        // Добавляем карточку в сетку
        articlesGrid.insertAdjacentHTML('beforeend', articleCard);
      });

    } catch (error) {
      console.error('Ошибка при загрузке статей:', error);
      articlesGrid.innerHTML = '<p class="text-center" style="grid-column: 1 / -1; color: #E53E3E;">Не удалось загрузить статьи. Пожалуйста, попробуйте позже.</p>';
    }
  }

  // Запускаем функцию
  loadArticles();
});