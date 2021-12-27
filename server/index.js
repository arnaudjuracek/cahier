#!/usr/bin/env node

const http = require('http')
const path = require('path')
const express = require('express')
const dotenv = require('dotenv')
const session = require('express-session')
// const WebSocket = require('ws') // TODO[ws]

dotenv.config({ path: path.resolve(__dirname, '.env') })

const app = express()
const server = http.createServer(app)
// const wss = new WebSocket.Server({ noServer: true })
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

// Websocket authentication handling
// server.on('upgrade', (request, socket, head) => {
//   sessionParser(request, {}, () => {
//     if (!request.session.authenticated) {
//       socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
//       socket.destroy()
//       return
//     }

//     wss.handleUpgrade(request, socket, head, ws => {
//       wss.emit('connection', ws, request)
//     })
//   })
// })

// Server startup
server.listen(process.env.PORT, () => {
  console.log(new Date(), `Server is up and running on port ${process.env.PORT}`)
})
