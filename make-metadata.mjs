import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'

const exec = promisify(execFile)

const INPUT_DIR = './original'
const OUT_META = './build/book.ffmeta'

async function ffprobeJSON(file) {
  const { stdout } = await exec('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file
  ])
  return JSON.parse(stdout)
}

function ms(sec) {
  return Math.round(parseFloat(sec) * 1000)
}

async function main() {
  const files = (await fs.readdir(INPUT_DIR))
    .filter(f => f.endsWith('.mp3'))
    .sort()

  if (files.length === 0) {
    throw new Error('MP3 файлы не найдены')
  }

  const chapters = []
  let offset = 0

  let bookTags = null

  for (const file of files) {
    const fullPath = path.join(INPUT_DIR, file)
    const meta = await ffprobeJSON(fullPath)

    const duration = meta.format.duration
    const title = meta.format.tags?.title ?? path.parse(file).name

    if (!bookTags) {
      bookTags = meta.format.tags ?? {}
    }

    const start = offset
    const end = offset + ms(duration)

    chapters.push({
      title,
      start,
      end
    })

    offset = end
  }

  // ---- формируем FFMETADATA1 ----

  let out = `;FFMETADATA1\n`

  const map = {
    title: 'album',
    artist: 'artist',
    album_artist: 'album_artist',
    genre: 'genre',
    date: 'date',
    copyright: 'copyright',
    comment: 'comment'
  }

  for (const [dst, src] of Object.entries(map)) {
    if (bookTags[src]) {
      out += `${dst}=${bookTags[src]}\n`
    }
  }

  out += `media_type=2\n` // 2 = audiobook

  out += '\n'

  for (const ch of chapters) {
    out += `[CHAPTER]\n`
    out += `TIMEBASE=1/1000\n`
    out += `START=${ch.start}\n`
    out += `END=${ch.end}\n`
    out += `title=${ch.title}\n\n`
  }

  await fs.mkdir(path.dirname(OUT_META), { recursive: true })
  await fs.writeFile(OUT_META, out, 'utf8')

  console.log(`✔ metadata written to ${OUT_META}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
