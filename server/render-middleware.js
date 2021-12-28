const fs = require('fs-extra')
const path = require('path')
const parseurl = require('parseurl')
const { decode } = require('html-entities')
const moment = require('moment')

require('handlebars').registerHelper({
  plaintext: string => string ? decode(string.replace(/(<([^>]+)>)/ig, '')) : string,
  date: (isoString, format = '') => isoString && moment(isoString).format(typeof format === 'string' ? format : '')
})

const render = {
  authenticate: require('./templates/authenticate'),
  directory: require('./templates/directory'),
  document: require('./templates/document')
}

module.exports = async (req, res, next) => {
  const dir = path.resolve(__dirname, process.env.CONTENT)

  // Find resource
  const url = parseurl.original(req)
  const resource = await findResource(path.join(dir, url.path), ['md'])
  if (!resource) return next()
  const stat = await fs.stat(resource)

  // Check if .lock file exists
  const lockFile = stat.isDirectory()
    ? path.join(resource, '.lock')
    : path.join(path.dirname(resource), '.lock')

  // Get challenge from either content of .lock file or env password
  const challenge = await fs.pathExists(lockFile) &&
    ((await fs.readFile(lockFile, 'utf8') || '').trim() || process.env.PASSWORD)

  // Check if resource can be accessed
  const allowed = !challenge || auth(req, challenge)

  // Keep track of allowed accesses in session
  if (allowed) {
    req.session.allowed = Array.from(new Set([...(req.session.allowed || []), url.path]))
  }

  // PRG pattern, see https://en.wikipedia.org/wiki/Post/Redirect/Get
  if (req.method === 'POST' && allowed) return res.redirect(url.href)

  // Render and send HTML
  res.send(await render[
    allowed
      ? (stat.isDirectory() ? 'directory' : 'document')
      : 'authenticate'
  ](resource, url))
  next()
}

function auth (req, challenge) {
  const match = password => password && challenge.split('\n').find(c => c === password)

  // Try to auth using current POST body
  if (req.method === 'POST' && match(req.body.password)) {
    req.session.passwords = [...(req.session.passwords || []), req.body.password]
    return true
  }

  // Try to auth using previous session passwords
  for (const password of req.session.passwords || []) {
    if (match(password)) return true
  }
}

// Given a path, find the first file matching an array of extension, then
// fallback to a possible directory
async function findResource (path, extensions = process.env.EXTENSIONS.split(',')) {
  if (await fs.pathExists(path)) return path

  for (const extension of extensions) {
    const candidate = path + '.' + extension
    if (await fs.pathExists(path + '.' + extension)) return candidate
  }
}
