# MP3 → M4B Audiobook Pipeline

Шаблон репозитория для сборки **аудиокниг в формате M4B** из набора MP3-файлов.

Репозиторий решает типовую задачу:

- исходник — набор MP3 (каждый файл = глава)
- на выходе — один **.m4b** файл
  - с обложкой
  - с главами
  - с корректными метаданными (автор, название, год, издательство)
  - совместимый с **Apple Books / iOS / macOS**

---

## Требования

- **Node.js ≥ 18**
- **ffmpeg ≥ 6** (включая `ffprobe`)

Проверка:

```bash
node -v
ffmpeg -version
```

---

## Структура проекта

```text
.
├── original/           # исходные mp3 (по главам)
│   ├── 00-vvedenie.mp3
│   ├── 01-glava-1.mp3
│   └── ...
├── build/              # временные и промежуточные файлы
│   ├── book.ffmeta     # FFMETADATA1 (генерируется)
│   ├── list.txt        # список файлов для concat
│   ├── audio.m4a       # склеенное аудио (AAC)
│   └── cover.jpg       # обложка
├── make-metadata.mjs   # Node.js скрипт генерации метаданных
└── README.md
```

---

## Принцип работы пайплайна

0. **Скачиваются исходные MP3** в папку `original/` (вручную или скриптом)

1. **MP3 анализируются через ffprobe**
   - извлекаются теги книги (album, artist, year и т.д.)
   - извлекаются названия глав
   - считаются длительности

2. **Node.js-скрипт**
   - генерирует `FFMETADATA1`
   - формирует главы (`[CHAPTER]`) с корректными таймкодами

3. **ffmpeg**
   - склеивает MP3
   - перекодирует звук в AAC (требование контейнера MP4/M4B)
   - добавляет метаданные и обложку

---

## Шаг 0. Подготовка исходных MP3

Скачай или скопируй MP3-файлы в папку `original/`. Каждый файл — отдельная глава.

```bash
#!/bin/bash

for i in {01..99}; do
  wget "https://example.com/audio/123/chapter-(printf %02d $i).mp3"
done

mkdir ../build

wget -O ../build/cover.jpg "https://example.com/audio/123/cover.jpg"

```

---

## Шаг 1. Генерация метаданных

```bash
node make-metadata.mjs
```

Результат:

```text
build/book.ffmeta
```

Файл содержит:

- общие метаданные книги
- главы с миллисекундной точностью

Пример:

```ini
;FFMETADATA1
title=Спасите котика!
artist=Блэйк Снайдер
media_type=2

[CHAPTER]
TIMEBASE=1/1000
START=0
END=927260
title=Введение
```

---

## Шаг 2. Подготовка списка файлов

```bash
printf "file '../%s'\n" original/*.mp3 > build/list.txt
```

Используется concat demuxer ffmpeg.

---

## Шаг 3. Склейка и перекодирование аудио

MP3 **нельзя** просто скопировать в M4A/M4B → требуется перекодирование в AAC.

```bash
ffmpeg -f concat -safe 0 -i build/list.txt \
  -map 0:a:0 \
  -c:a aac -q:a 2 \
  build/audio.m4a
```

Можно указать требуемое качество. Ниже пример, если требуется фиксированный битрейт в 128k

```bash
ffmpeg -f concat -safe 0 -i build/list.txt \
  -map 0:a:0 \
  -c:a aac -b:a 128k \
  build/audio.m4a
```

Что происходит:

- MP3 декодируются
- аудио кодируется в AAC (VBR или 128k)
- обложки и лишние стримы отбрасываются

---

## Шаг 4. Извлечение обложки

Берём embedded cover из первого MP3:

```bash
ffmpeg -i original/01.mp3 \
  -an -map 0:v:0 -c:v copy \
  build/cover.jpg
```

Если обложки нет, положи свою `cover.jpg` в папку `build/`.

---

## Шаг 5. Финальная сборка M4B

```bash
ffmpeg \
  -i build/audio.m4a \
  -i build/book.ffmeta \
  -i build/cover.jpg \
  -map 0:a \
  -map_metadata 1 \
  -map 2:v \
  -c copy \
  -disposition:v attached_pic \
  book.m4b
```

На выходе:

```text
book.m4b
```

Файл содержит:

- AAC аудио
- обложку (attached picture)
- главы
- корректные метаданные

---

## Проверка результата

```bash
ffprobe book.m4b
```

Проверь:

- наличие `[CHAPTER]`
- `media_type=2`
- attached picture

Рекомендуется открыть в **Apple Books**.

---

## Почему именно так

- MP4/M4B **не поддерживает MP3** → обязателен AAC
- главы в M4B — это **CHAPTER**, а не ID3-теги
- embedded cover в MP3 нельзя тащить напрямую через concat
- `media_type=2` — критично для Apple Books

---

## Возможные улучшения

- автоматическая сборка одной командой
- поддержка ALAC вместо AAC
- нормализация громкости (EBU R128)
- валидация тегов
- поддержка нескольких томов

---

## Полезные ссылки

- [Prologue](https://prologue.audio/)
- [Audiobookshelf](https://github.com/advplyr/audiobookshelf)
- [M4B Metadata](https://github.com/prologueapp/Prologue/wiki/Metadata)
