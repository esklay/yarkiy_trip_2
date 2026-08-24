package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"os"
	"path/filepath"
	"strings"
)

type EmailConfig struct {
	PublicKey   string `json:"publicKey"`
	ServiceId   string `json:"serviceId"`
	TemplateId  string `json:"templateId"`
	TargetEmail string `json:"targetEmail"`
}

type SiteConfig struct {
	Email EmailConfig `json:"emailjs"`
}

type LocalizedField struct {
	RU string `json:"ru"`
	EN string `json:"en"`
}

func (l LocalizedField) Get(lang string) string {
	if lang == "en" && l.EN != "" {
		return l.EN
	}
	return l.RU
}

type LocalizedString struct {
	value    string
	byLocale map[string]string
}

func (l *LocalizedString) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err == nil {
		l.value = s
		return nil
	}
	var m map[string]string
	if err := json.Unmarshal(b, &m); err != nil {
		return err
	}
	l.byLocale = m
	return nil
}

func (l LocalizedString) Get(lang string) string {
	if l.byLocale != nil {
		if v, ok := l.byLocale[lang]; ok {
			return v
		}
	}
	return l.value
}

// String() позволяет писать {{ .Title }} в шаблонах напрямую
func (l LocalizedString) String() string {
	if l.value != "" {
		return l.value
	}
	if v, ok := l.byLocale["ru"]; ok {
		return v
	}
	for _, v := range l.byLocale {
		return v
	}
	return ""
}

type ArticleMetadata struct {
	ID       string          `json:"id"`
	URL      string          `json:"url"`
	Date     LocalizedString `json:"date"`
	Title    LocalizedString `json:"title"`
	Excerpt  LocalizedString `json:"excerpt"`
	Category LocalizedString `json:"category"`
	Image    string          `json:"image"`
	Author   LocalizedString `json:"author"`
	Content  LocalizedString `json:"content"`
	Slides   []string        `json:"slides,omitempty"` // Опционально: явный список путей к слайдам
}

type Strings map[string]string

type IndexTemplateData struct {
	Config    SiteConfig
	Articles  []ArticleMetadata
	RootPath  string // ссылки на страницы ТЕКУЩЕЙ языковой версии
	AssetPath string // ссылки на css/js/images (корень сайта)
	AltLink   string // та же страница в другом языке
	Lang      string
	Strings   Strings
}

type ArticleTemplateData struct {
	ArticleMetadata
	Content   template.HTML
	RootPath  string
	AssetPath string
	AltLink   string
	Lang      string
	Strings   Strings
	Slides    []string // Массив путей к картинкам слайдера (для динамической генерации)
}

// Данные для страницы ретрита "Цветок Жизни"
// URL — пустая строка, чтобы header.tmpl не считал страницу статьёй
// (переключатель языка будет работать через AltLink)
type FlowerTemplateData struct {
	Config    SiteConfig
	RootPath  string
	AssetPath string
	AltLink   string
	Lang      string
	Strings   Strings
	URL       string
}

var supportedLangs = []string{"ru", "en"}

var funcMap = template.FuncMap{
	"split": strings.Split,
	"add":   func(a, b int) int { return a + b },
	"sub":   func(a, b int) int { return a - b },
	"safeHTML": func(s interface{}) template.HTML {
		switch v := s.(type) {
		case string:
			return template.HTML(v)
		case template.HTML:
			return v
		default:
			return ""
		}
	},
}

func main() {
	log.Println("🚀 Запуск сборки проекта...")

	// 1. Конфигурация
	configData, err := os.ReadFile("config.json")
	if err != nil {
		log.Fatalf("❌ Ошибка чтения config.json: %v", err)
	}
	var siteConfig SiteConfig
	if err := json.Unmarshal(configData, &siteConfig); err != nil {
		log.Fatalf("❌ Ошибка парсинга config.json: %v", err)
	}

	// 2. Словари i18n
	i18n := make(map[string]Strings)
	for _, lang := range supportedLangs {
		path := filepath.Join("data", "i18n", lang+".json")
		data, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("❌ Не найден словарь %s: %v", path, err)
		}
		var s Strings
		if err := json.Unmarshal(data, &s); err != nil {
			log.Fatalf("❌ Ошибка парсинга %s: %v", path, err)
		}
		i18n[lang] = s
	}
	log.Printf("  📖 Загружено словарей: %d", len(i18n))

	// 3. Статьи
	byteValue, err := os.ReadFile("data/articles.json")
	if err != nil {
		log.Fatalf("❌ Ошибка чтения data/articles.json: %v", err)
	}
	var articles []ArticleMetadata
	if err := json.Unmarshal(byteValue, &articles); err != nil {
		log.Fatalf("❌ Ошибка парсинга JSON статей: %v", err)
	}

	// 4. Шаблоны (добавлен flower-of-life.tmpl)
	tmpl, err := template.New("").Funcs(funcMap).ParseFiles(
		"header.tmpl",
		"footer.tmpl",
		"index.tmpl",
		"src-articles/template.html",
		"flower-of-life.tmpl",
	)
	if err != nil {
		log.Fatalf("❌ Ошибка парсинга шаблонов: %v", err)
	}

	// 5. Генерация для каждого языка (БЕЗ копирования ассетов)
	for _, lang := range supportedLangs {
		log.Printf("\n🌍 Язык: %s", lang)

		outDir := ""
		altIndex := "en/index.html"
		assetPath := "" // ru: ассеты в корне, префикс не нужен

		if lang != "ru" {
			outDir = lang
			altIndex = "../index.html"
			assetPath = "../" // en index: корень сайта на уровень выше
			if err := os.MkdirAll(filepath.Join(outDir, "articles"), 0755); err != nil {
				log.Fatalf("❌ Ошибка создания директории %s/articles: %v", outDir, err)
			}
		} else {
			if err := os.MkdirAll("articles", 0755); err != nil {
				log.Fatalf("❌ Ошибка создания директории articles: %v", err)
			}
		}

		// Статьи
		for _, meta := range articles {
			var altLink string
			if lang == "ru" {
				altLink = "../en/" + meta.URL
			} else {
				altLink = "../../" + meta.URL
			}
			if err := generateArticle(tmpl, meta, lang, i18n[lang], altLink, outDir); err != nil {
				log.Printf("⚠️ Пропуск статьи %s (%s): %v", meta.ID, lang, err)
				continue
			}
		}

		// Главная
		if err := generateIndex(tmpl, siteConfig, articles, lang, i18n[lang], "", assetPath, altIndex, outDir); err != nil {
			log.Fatalf("❌ Ошибка генерации index.html (%s): %v", lang, err)
		}

		// Ретрит "Цветок Жизни"
		// flower-of-life.html лежит в корне (для ru) и в en/ (для en) —
		// как и index.html, поэтому пути идентичны index
		var flowerAltLink string
		if lang == "ru" {
			flowerAltLink = "en/flower-of-life.html"
		} else {
			flowerAltLink = "../flower-of-life.html"
		}
		if err := generateFlowerOfLife(tmpl, siteConfig, lang, i18n[lang], "", assetPath, flowerAltLink, outDir); err != nil {
			log.Printf("⚠️ Пропуск flower-of-life.html (%s): %v", lang, err)
		}
	}

	log.Println("\n✅ Сборка успешно завершена для всех языков!")
}

// collectSlides собирает массив путей к картинкам слайдера для статьи.
//
// Приоритет:
//  1. Если в articles.json задан slides — используется как есть (полный контроль;
//     если нужна обложка первой — включите её в список сами).
//  2. Иначе автогенерация:
//     - первый слайд — обложка из поля image (если файл существует);
//     - затем файлы images/articles/article-{ID}-{1..12}.jpg,
//       за исключением совпадающих с обложкой (защита от дублирования).
//
// Итоговое поведение в шаблоне:
//   - 0 слайдов → блок с картинкой не рендерится вообще;
//   - 1 слайд   → обычная картинка 16:9 без элементов слайдера;
//   - 2+ слайдов→ полноценный слайдер, плашка с названием на первом слайде.
func collectSlides(meta ArticleMetadata) []string {
	// Явный список из articles.json — полный контроль, используем как есть
	if len(meta.Slides) > 0 {
		return meta.Slides
	}

	var slides []string

	// Первый слайд — обложка из поля image (та же, что в карточке на главной)
	if meta.Image != "" {
		if _, err := os.Stat(meta.Image); err == nil {
			slides = append(slides, meta.Image)
		} else {
			log.Printf("⚠️ Обложка %s не найдена — первый слайд пропущен", meta.Image)
		}
	}

	// Дополнительные слайды: article-{ID}-{1..12}.jpg
	for i := 1; i <= 12; i++ {
		candidate := fmt.Sprintf("images/articles/article-%s-%d.jpg", meta.ID, i)
		// Не дублируем обложку, если она указана и в image, и в файлах
		if candidate == meta.Image {
			continue
		}
		if _, err := os.Stat(candidate); err == nil {
			slides = append(slides, candidate)
		}
	}

	return slides
}

func generateArticle(tmpl *template.Template, meta ArticleMetadata, lang string, s Strings, altLink, outDir string) error {
	cleanPath := filepath.Clean(meta.URL)
	if !strings.HasPrefix(cleanPath, "articles/") {
		return fmt.Errorf("небезопасный путь: %s", meta.URL)
	}

	var absPath string
	if outDir == "" {
		absPath, _ = filepath.Abs(cleanPath)
	} else {
		absPath, _ = filepath.Abs(filepath.Join(outDir, cleanPath))
	}

	srcPath := meta.Content.Get(lang)
	if srcPath == "" {
		fileName := filepath.Base(meta.URL)
		srcPath = filepath.Join("src-articles", lang, fileName)
	}

	contentBytes, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf("файл контента %s не найден: %v", srcPath, err)
	}

	contentStr := string(contentBytes)

	// Нормализация inline-картинок в en-статьях:
	// автор пишет src="../images/..." в обоих языках,
	// а для en (страница на уровень глубже) генератор сам ставит ../../
	if lang != "ru" {
		contentStr = strings.ReplaceAll(contentStr, `src="../`, `src="../../`)
	}

	// === СБОР СЛАЙДОВ ===
	slides := collectSlides(meta)

	// Разрешаем локализованные поля в конкретные строки
	localizedMeta := meta
	localizedMeta.Title = LocalizedString{value: meta.Title.Get(lang)}
	localizedMeta.Excerpt = LocalizedString{value: meta.Excerpt.Get(lang)}
	localizedMeta.Category = LocalizedString{value: meta.Category.Get(lang)}
	localizedMeta.Date = LocalizedString{value: meta.Date.Get(lang)}
	localizedMeta.Author = LocalizedString{value: meta.Author.Get(lang)}
	localizedMeta.Content = LocalizedString{value: meta.Content.Get(lang)}

	// Статьи всегда на уровень глубже корня своей языковой версии
	rootPath := "../"
	assetPath := "../" // ru: из articles/ в корень
	if lang != "ru" {
		assetPath = "../../" // en: из en/articles/ в корень
	}

	data := ArticleTemplateData{
		ArticleMetadata: localizedMeta,
		Content:         template.HTML(contentStr),
		RootPath:        rootPath,
		AssetPath:       assetPath,
		AltLink:         altLink,
		Lang:            lang,
		Strings:         s,
		Slides:          slides, // Передаём собранный массив в шаблон
	}

	outFile, err := os.Create(absPath)
	if err != nil {
		return fmt.Errorf("ошибка создания %s: %v", absPath, err)
	}
	defer outFile.Close()

	if err := tmpl.ExecuteTemplate(outFile, "article", data); err != nil {
		return fmt.Errorf("ошибка рендеринга %s: %v", absPath, err)
	}

	log.Printf("  📄 Статья [%s]: %s (%d слайдов)", lang, meta.URL, len(slides))
	return nil
}

func generateIndex(tmpl *template.Template, config SiteConfig, articles []ArticleMetadata, lang string, s Strings, rootPath, assetPath, altLink, outDir string) error {
	if _, err := os.Stat("index.tmpl"); err != nil {
		return nil
	}

	outPath := "index.html"
	if outDir != "" {
		outPath = filepath.Join(outDir, "index.html")
	}

	indexFile, err := os.Create(outPath)
	if err != nil {
		return fmt.Errorf("ошибка создания %s: %v", outPath, err)
	}
	defer indexFile.Close()

	data := IndexTemplateData{
		Config:    config,
		Articles:  articles,
		RootPath:  rootPath,
		AssetPath: assetPath,
		AltLink:   altLink,
		Lang:      lang,
		Strings:   s,
	}

	if err := tmpl.ExecuteTemplate(indexFile, "index", data); err != nil {
		return fmt.Errorf("ошибка рендеринга %s: %v", outPath, err)
	}

	log.Printf("  🏠 index.html [%s] сгенерирован: %s", lang, outPath)
	return nil
}

// generateFlowerOfLife генерирует страницу ретрита "Цветок Жизни".
// Файл flower-of-life.html генерируется:
//   - для ru: в корне сайта (/flower-of-life.html)
//   - для en: в подпапке (/en/flower-of-life.html)
//
// Если flower-of-life.tmpl отсутствует — функция молча пропускает генерацию
// (сайт может работать и без страницы ретрита).
func generateFlowerOfLife(tmpl *template.Template, config SiteConfig, lang string, s Strings, rootPath, assetPath, altLink, outDir string) error {
	if _, err := os.Stat("flower-of-life.tmpl"); err != nil {
		return nil // Файл шаблона не существует, пропускаем
	}

	outPath := "flower-of-life.html"
	if outDir != "" {
		outPath = filepath.Join(outDir, "flower-of-life.html")
	}

	flowerFile, err := os.Create(outPath)
	if err != nil {
		return fmt.Errorf("ошибка создания %s: %v", outPath, err)
	}
	defer flowerFile.Close()

	data := FlowerTemplateData{
		Config:    config,
		RootPath:  rootPath,
		AssetPath: assetPath,
		AltLink:   altLink,
		Lang:      lang,
		Strings:   s,
		URL:       "", // Не статья — переключатель языка будет использовать AltLink
	}

	if err := tmpl.ExecuteTemplate(flowerFile, "flower", data); err != nil {
		return fmt.Errorf("ошибка рендеринга %s: %v", outPath, err)
	}

	log.Printf("  🌸 flower-of-life.html [%s] сгенерирован: %s", lang, outPath)
	return nil
}