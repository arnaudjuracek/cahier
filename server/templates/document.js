const fs = require('fs-extra')
const path = require('path')
const YAML = require('yaml')
const template = require('handlebars').compile(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'templates', 'document.hbs'),
    'utf8'
  )
)

const anchor = require('markdown-it-anchor')
const HLJS = require('highlight.js')
const Markdown = require('markdown-it')({
  html: true,
  linkify: true,
  typographer: true,
  quotes: ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'],
  langPrefix: '',
  highlight: (code, lang) => HLJS.highlight(code, {
    language: HLJS.getLanguage(lang) ? lang : 'plaintext'
  }).value
}).use(require('markdown-it-abbr'))
  .use(require('markdown-it-emoji'))
  .use(require('markdown-it-footnote'))
  .use(require('markdown-it-mark'))
  .use(anchor, {
    level: 1,
    permalink: anchor.permalink.linkInsideHeader({
      symbol: '¶',
      class: 'anchor'
    })
  })

module.exports = async (resource, url) => {
  const file = await fs.readFile(resource, 'utf8')
  const metadata = await module.exports.readMetadata(resource, file)

  let html = template({
    isProduction: process.env.NODE_ENV !== 'development',
    markdown: Markdown.render(file
      // Widont on headings
      .replace(/^(#{1,6}\s.*) +(\W+)$/gmi, '$1&nbsp;$2')
      .replace(/^(#{1,6}\s.*) +([^`\s]+)$/gmi, '$1&nbsp;$2')
      // Remove front matter block
      .replace(/^---(.|\n|\r)*?---/, '')
    ),
    ...metadata
  })

  html = html
    // Always render sup/sub inline when this is the only element on the line
    .replace(/<p>(<sup>.*<\/sup>)<\/p>/gi, '$1')
    .replace(/<p>(<sub>.*<\/sub>)<\/p>/gi, '$1')
    // Ensure [[discuss]] is not wrapped inside a <p>
    .replace(/<p>(\[\[\s?discuss(:\w+)?\s?(readonly)?\s\]\])<\/p>/gi, '$1')

  // Replace [[discuss]] by an HTML container for its jsx Component
  const logFile = resource.replace(metadata.extension, '.log')
  const log = (await fs.pathExists(logFile)) && (await fs.readJson(logFile, { throws: false }))
  for (const discuss of html.match(/(\[\[\s?discuss.*\]\])/g) || []) {
    const context = (discuss.match(/:([\w-]+)/) || [])[1] || 'log'
    const readonly = /readonly\s\]\]/.test(discuss)
    html = html.replace(discuss, `
      <script
        type='application/json'
        class='discuss-data'
        data-context='${context}'
        ${metadata.lang ? `lang='${metadata.lang}'` : ''}
        ${readonly ? 'readonly' : ''}
      >${JSON.stringify((log && log[context]) || [])}</script>
    `)
  }

  return html
}

module.exports.readMetadata = async (resource, file = null) => {
  if (!file) file = await fs.readFile(resource, 'utf8')

  const extension = path.extname(resource)
  const filename = path.basename(resource, extension)
  const dirname = path.basename(path.dirname(resource))
  const frontMatter = YAML.parse(
    (file.match(/^---(([\s\S])+?)---/) || [])[1] || ''
  )

  return {
    ...(frontMatter || {}),
    extension,
    filename,
    dirname: dirname === path.basename(process.env.CONTENT) ? '/' : dirname,
    lastmod: (await fs.stat(resource)).mtime
  }
}
