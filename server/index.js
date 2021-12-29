#!/usr/bin/env node

const fs = require('fs-extra')
const http = require('http')
const path = require('path')
const express = require('express')
const dotenv = require('dotenv')
const parseurl = require('parseurl')
const session = require('express-session')
const WebSocket = require('ws')

dotenv.config({ path: path.resolve(__dirname, '.env') })

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ noServer: true })
const sessionParser = session({
  saveUninitialized: true,
  secret: process.env.PASSWORD,
  resave: false,
  cookie: {
    maxAge: 365 * 24 * 60 * 60 * 1000
  }
})

// Log request
app.use((req, res, next) => {
  if (process.env.VERBOSE || process.env.NODE_ENV === 'development') {
    console.log(new Date(), req.originalUrl)
  }
  next()
})

// Handle session
app.use(sessionParser)

// Webpack middlewares
if (process.env.NODE_ENV === 'development') {
  const webpack = require('webpack')
  const config = require('../webpack.config.js')
  const compiler = webpack(config)
  const hotMiddleware = require('webpack-hot-middleware')(compiler)
  const devMiddleware = require('webpack-dev-middleware')(compiler, {
    serverSideRender: true,
    stats: 'errors-warnings',
    publicPath: config.output.publicPath
  })

  app.use(devMiddleware)
  app.use(hotMiddleware)
}

// Serve static files
const highlightTheme = require.resolve('highlight.js/styles/github-dark.css')
app.use(express.static(path.join(__dirname, '..', 'build')))
app.use(express.static(path.join(__dirname, '..', 'static')))
app.get('/highlight.css', (_, res) => res.sendFile(highlightTheme))
app.use((req, res, next) => /\.(md|lock)$/.test(req.baseUrl)
  ? next()
  : express.static(path.resolve(__dirname, process.env.CONTENT))(req, res, next)
)

// Core renderer
app.use(express.urlencoded({ extended: true }))
app.use(require('./render-middleware'))

// Log errors
app.use((err, req, res, next) => {
  console.error(new Date(), err)
  res.status(500).json({ error: err.message })
})

// Websocket
wss.on('connection', async (ws, req) => {
  const url = parseurl.original(req)
  const logFile = path.join(__dirname, process.env.CONTENT, url.path + '.log')

  ws.on('message', async message => {
    const entry = JSON.parse(message.toString())
    const context = entry.context
    delete entry.context

    await fs.ensureFile(logFile)
    const log = await fs.readJson(logFile, { throws: false }) || {}
    log[context] = [...(log[context] || []), entry]

    await fs.writeJson(logFile, log, { spaces: '  ' })
    for (const client of wss.clients) client.send(JSON.stringify(log))
  })
})

// Websocket authentication handling
server.on('upgrade', (req, socket, head) => {
  sessionParser(req, {}, () => {
    const url = parseurl.original(req)
    if (!req.session.allowed || !req.session.allowed.find(path => path === url.path)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req)
    })
  })
})

// Server startup
server.listen(process.env.PORT, () => {
  console.log(new Date(), `Server is up and running on port ${process.env.PORT}`)
})
