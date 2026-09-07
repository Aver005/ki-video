# ARCHITECTURE
> Слои и поток данных. Last updated: 2026-09-07.

## Слои

```
src/core    ← чистый изоморфный код без Bun и DOM. Модель, математика, ffmpeg-аргументы, ASS.
src/server  ← Bun: процессы ffmpeg, файлы, HTTP/WS. Зависит от core.
интерфейс   ← браузер, разложен по FSD (ниже). Зависит от core.
```

Сервер и интерфейс друг о друге не знают. Типы проверяются раздельно (`tsconfig.json` с
`bun-types`, `tsconfig.app.json` с DOM), иначе DOM-типы ломают `ReadableStream` из Bun.

### Feature-Sliced Design в интерфейсе

```
src/app       ← точка входа, App.tsx, стили, ещё не перенесённые компоненты
src/pages     ← пока пусто
src/widgets   ← app-header, transport
src/features  ← split-item
src/entities  ← project (документ целиком), player, asset
src/shared    ← ui (shadcn) и ui/kit (свои составные), api/client.ts, model/{store,editor}.ts
```

`entities/project` — один срез на весь документ, сегменты по предметам:
`session` (история, сохранение, `commit`/`update`), `tracks`, `items`, `frame`, `box`, `color`,
`subtitles`, `current` (элемент под курсором), `selectors` (хуки чтения).
Отдельного `entities/timeline` нет намеренно: дорожки и элементы живут внутри проекта, и на каждую
правку получался бы импорт внутри одного слоя.

Слой видит только слои ниже себя плюс `@core/*`. Импорты всегда через алиасы, в том числе внутри
среза: `@app/*`, `@pages/*`, `@widgets/*`, `@features/*`, `@entities/*`, `@shared/*`, `@core/*`.
Публичный вход среза — его `index.ts`; исключение `@shared/ui/*`, куда файлы кладёт CLI shadcn.

Направление импортов проверяется поиском: `@app/*` из нижних слоёв — ноль вхождений,
`shared → entities/features/widgets` — ноль, `entities → features/widgets` — ноль.

## Поток данных

1. Импорт: путь → `ffprobe` → `MediaAsset(processing)` → очередь по одному → один вызов `ffmpeg`.
   Видео даёт `proxy.mp4`, `thumbs/%04d.jpg`, `pcm.raw`; картинка — `still.jpg` и одну миниатюру;
   звук — `proxy.m4a` и `pcm.raw`. Дальше пики → `ready`. Всё в `.ki-data/cache/<id>`,
   `id = hash(путь|размер|mtime)`: тот же файл повторно не готовится. Вид файла — по расширению
   (`kindByExtension`), для файлов без видеодорожки — `audio`.
2. Проект: один `project.json`. Интерфейс держит копию в сторе, шлёт PUT с задержкой 400 мс.
3. Превью: `Player` держит свой источник на каждый элемент таймлайна (`<video>`, `<img>` или `<audio>`),
   рисует базу через `frameToRegion` из `core/frame.ts`, поверх — наложения по их геометрии,
   затем текст и субтитры. Время ведёт видео под курсором; на картинке и в зазоре — часы кадра.
   Коэффициент прокси/исходник = `proxy.width / width`.
4. Экспорт: `buildExportPlan` собирает аргументы, сервер пишет `subs.ass` в папку задания, запускает
   ffmpeg с `-progress pipe:1`, события идут по WS.

## Дорожки и элементы

`Project.tracks`: первая дорожка `content` — база кадра, дальше `overlay` (наложения и текст) в порядке
наложения, `audio` — только звук. Элемент стоит на шкале проекта (`start`, `duration`), у медиа есть
`offset` внутри исходника. Раскладка базы — `contentSegments` из `core/timeline.ts`: зазоры становятся
чёрными кусками, наезды — переходами. Длительность проекта — самый дальний край всех дорожек.

## Кадр 9:16 из горизонтального видео

Базовое окно: вся высота исходника с пропорцией выхода. Ключевой кадр — центр `(cx, cy)` и `zoom ≥ 1`.
Регион = базовое окно / zoom вокруг центра, прижатый к границам.

В ffmpeg: `crop=W:H:x(t):y(t)` (crop умеет менять только x/y по кадрам) → `scale` до выхода →
`zoompan` с `z(it)`, `x(it)`, `y(it)`, если есть зум. Выражения — кусочно-линейные `if(lt(t,..),..)`.
`-ss/-t` стоят перед `-i`, поэтому `t` внутри клипа начинается с нуля.

## Граф экспорта

```
куски базы → concat / xfade → цветокор → overlay наложений → ass → [vo]
звук элементов (volume, afade, adelay) → amix → цепочка проекта → [ao]
```

Каждый элемент — свой вход ffmpeg (`-ss/-t`, у картинки `-loop 1 -t`). Наложение масштабируется долей
кадра, поворачивается `rotate ... c=none` по прозрачному фону, гасится `colorchannelmixer=aa` и
`fade=alpha`, встаёт на место через `setpts+start` и `overlay ... enable`.

## Интерфейс: shadcn на React Aria

Компоненты ставятся официальным CLI shadcn с базой React Aria: `bunx shadcn@latest add <имя>`.
Настройки в `components.json` (стиль `aria-nova`, палитра `zinc`), файлы кладутся в `src/shared/ui`.
Стили собирает Tailwind v4 через `bun-plugin-tailwind` — он подключён и к dev-серверу
(`bunfig.toml`), и к сборке exe (`scripts/build.ts`).

Единственный вход стилей — `src/app/styles/globals.css`. Старые `theme.css`, `layout.css`,
`animations.css` втянуты в него через `layer(base)` и `layer(components)`: они лежат ниже утилит
Tailwind и по мере переноса компонентов вычищаются.

## Текст и субтитры

Один ASS-файл на экспорт: стиль `Sub` из пресета, текстовые элементы дорожек строками с `\pos`, `\fs`, `\c`, `\3c`. Скрытые дорожки в файл не попадают.
Превью рисует то же на canvas (Arial, обводка `strokeText`). Совпадение не попиксельное.

## Окно приложения

У Bun нет нативного окна (`Bun.WebView` только headless). Запускаем Edge или Chrome с `--app=URL` и
отдельным `--user-data-dir` внутри `.ki-data`. Exe собирается с `--windows-hide-console`.
