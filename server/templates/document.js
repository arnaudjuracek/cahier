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
  .use(require('markdown-it-attribution'), {
    marker: '--',
    classNameContainer: 'blockquote-with-attribution',
    classNameAttribution: null
  })
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
    // Prevent floating punctuation
    .replace(/([\w>])\s([:?!])/g, '$1&#8239;$2')
    // Replace fractions
    .replace(/\b1\/2([^\d])/g, '&frac12;$1') // ½
    .replace(/\b1\/3([^\d])/g, '&frac13;$1') // ⅓
    .replace(/\b2\/3([^\d])/g, '&frac23;$1') // ⅔
    .replace(/\b1\/4([^\d])/g, '&frac14;$1') // ¼
    .replace(/\b3\/4([^\d])/g, '&frac34;$1') // ¾
    .replace(/\b1\/5([^\d])/g, '&frac15;$1') // ⅕
    .replace(/\b2\/5([^\d])/g, '&frac25;$1') // ⅖
    .replace(/\b3\/5([^\d])/g, '&frac35;$1') // ⅗
    .replace(/\b4\/5([^\d])/g, '&frac45;$1') // ⅘
    .replace(/\b1\/6([^\d])/g, '&frac16;$1') // ⅙
    .replace(/\b5\/6([^\d])/g, '&frac56;$1') // ⅚
    .replace(/\b1\/7([^\d])/g, '&frac17;$1') // ⅐
    .replace(/\b1\/8([^\d])/g, '&frac18;$1') // ⅛
    .replace(/\b3\/8([^\d])/g, '&frac38;$1') // ⅜
    .replace(/\b5\/8([^\d])/g, '&frac58;$1') // ⅝
    .replace(/\b7\/8([^\d])/g, '&frac78;$1') // ⅞
    .replace(/\b1\/9([^\d])/g, '&#2151;$1') // ⅑
    .replace(/\b1\/10([^\d])/g, '&#8530;$1') // ⅒

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
