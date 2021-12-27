const fs = require('fs-extra')
const path = require('path')
const template = require('handlebars').compile(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'templates', 'directory.hbs'),
    'utf8'
  )
)

const CACHE = new Map()

async function isEmpty (directory, extensions = process.env.EXTENSIONS.split(',')) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      if (!(await isEmpty(path.join(directory, entry.name)))) return false
      continue
    }

    const ext = path.extname(entry.name).substr(1)
    if (entry.isFile() && extensions.includes(ext)) return false
  }

  return true
}

async function getFileTitle (filepath) {
  const basename = path.basename(filepath)
  if (path.extname(filepath) !== '.md') return basename

  if (CACHE.has(filepath)) return CACHE.get(filepath)
  const file = await fs.readFile(filepath, 'utf8')
  const title = (file.match(/^#\s(.*)$/mi) || [])[1] || basename
  CACHE.set(filepath, title)
  return title
}

module.exports = async (resource, url) => {
  const files = []
  const directories = []

  const entries = await fs.readdir(resource, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      const directory = path.join(resource, entry.name)
      if (await isEmpty(directory)) continue
      directories.push({
        name: entry.name,
        url: entry.name,
        title: entry.name,
        isDirectory: true,
        isLocked: await fs.pathExists(path.join(directory, '.lock'))
      })
    } else {
      const ext = path.extname(entry.name)
      if (!process.env.EXTENSIONS.includes(ext.substr(1))) continue
      const file = path.join(resource, entry.name)
      files.push({
        name: entry.name,
        title: await getFileTitle(file),
        url: path.basename(entry.name, ext),
        modified: fs.statSync(file).mtime
      })
    }
  }

  return template({
    title: url.path === '/' ? '/' : path.basename(resource),
    isProduction: process.env.NODE_ENV !== 'development',
    entries: [].concat(directories, files)
  })
}
