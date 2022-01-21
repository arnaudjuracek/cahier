const fs = require('fs-extra')
const path = require('path')
const YAML = require('yaml')
const markdownToc = require('markdown-toc')
const anchor = require('markdown-it-anchor')
const Markdown = require('markdown-it')
const HLJS = require('highlight.js')

const template = require('handlebars').compile(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'templates', 'document.hbs'),
    'utf8'
  )
)

const QUOTES = {
  fr: ['«\u00A0', '\u00A0»', '‹\u00A0', '\u00A0›'],
  en: '“”‘’'
}

const PLUGINS = [
  [anchor, {
    level: 1,
    slugify: string => markdownToc.slugify(
      string
        .replace(/\u00A0/g, ' ')
        .replace(/[«»‹›“”‘’]/g, '')
        .replace(/\s+/g, ' ')
    ),
    permalink: anchor.permalink.linkInsideHeader({
      symbol: '¶',
      class: 'anchor'
    })
  }],
  require('markdown-it-abbr'),
  require('markdown-it-emoji'),
  require('markdown-it-footnote'),
  require('markdown-it-mark'),
  [require('markdown-it-attribution'), {
    marker: '--',
    classNameContainer: 'blockquote-with-attribution',
    classNameAttribution: null
  }]
]

module.exports = async (resource, url) => {
  let file = await fs.readFile(resource, 'utf8')

  // Apply some rules on raw markdown
  file = file
    // Widont on headings
    .replace(/^(#{1,6}\s.*) +(\W+)$/gmi, '$1\u00a0$2')
    .replace(/^(#{1,6}\s.*) +([^`\s]+)$/gmi, '$1\u00a0$2')
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
    // Replace multiplication sign
    .replace(/(\d+)\s?x\s?(\d+)/g, '$1\u00a0×\u00a0$2')

  const metadata = await module.exports.readMetadata(resource, file)

  const markdown = new Markdown({
    html: true,
    linkify: true,
    typographer: true,
    quotes: QUOTES[metadata.lang || 'en'],
    langPrefix: '',
    highlight: (code, lang) => HLJS.highlight(code, {
      language: HLJS.getLanguage(lang) ? lang : 'plaintext'
    }).value
  })

  for (const plugin of PLUGINS) {
    markdown.use(...Array.isArray(plugin) ? plugin : [plugin])
  }

  let html = template({
    isProduction: process.env.NODE_ENV !== 'development',
    markdown: markdown.render(file
      // Remove front matter block
      .replace(/^---(.|\n|\r)*?---/, '')
    ),
    toc: markdownToc(file).json.map(entry => {
      // Remove footnotes
      entry.content = entry.content.replace(/\[\^\d+\]/g, '')
      entry.markdown = markdown.render(entry.content)
      entry.slug = markdownToc.slugify(entry.content)
      return entry
    }),
    ...metadata
  })

  // Apply some rules on rendered markdown
  html = html
    // Always render sup/sub inline when this is the only element on the line
    .replace(/<p>(<sup>.*<\/sup>)<\/p>/gi, '$1')
    .replace(/<p>(<sub>.*<\/sub>)<\/p>/gi, '$1')
    // Ensure [[discuss]] is not wrapped inside a <p>
    .replace(/<p>(\[\[\s?discuss(:\w+)?\s?(readonly)?\s\]\])<\/p>/gi, '$1')
    // Prevent floating punctuation
    .replace(/([\w>])\s([:?!])/g, '$1&#8239;$2')

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

  if (frontMatter.author) {
    const [, name, email, website] = /^([^<(]+?)?[ \t]*(?:<([^>(]+?)>)?[ \t]*(?:\(([^)]+?)\)|$)/g.exec(frontMatter.author) || []
    frontMatter.author = { name, email, website }
  }

  return {
    ...(frontMatter || {}),
    extension,
    filename,
    dirname: dirname === path.basename(process.env.CONTENT) ? '/' : dirname,
    lastmod: (await fs.stat(resource)).mtime
  }
}
