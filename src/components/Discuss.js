import { Component } from 'utils/jsx'
import { writable } from 'utils/state'
import Websocket from 'reconnectingwebsocket'
import sanitize from 'sanitize-html'
import linkify from 'linkify-html'

const AUTHOR = writable(window.localStorage.getItem('discuss.author'))
AUTHOR.subscribe(author => window.localStorage.setItem('discuss.author', author))

const WebSocketServer = ({
  content: writable({}),
  isClosed: writable(true),
  sendJson: function (object) {
    this.socket.send(JSON.stringify(object))
  },
  open: function () {
    this.socket = new Websocket(window.location.href.replace('http', 'ws'))
    this.socket.onopen = () => this.isClosed.set(false)
    this.socket.onclose = () => this.isClosed.set(true)
    this.socket.onmessage = message => {
      try {
        const content = JSON.parse(message.data)
        this.content.set(content)
      } catch (error) {
        console.warn(error)
      }
    }
    return this
  }
}).open()

export default class Discuss extends Component {
  beforeRender (props) {
    this.update = this.update.bind(this)
    this.handleAuthor = this.handleAuthor.bind(this)
    this.handleTextarea = this.handleTextarea.bind(this)
    this.handleSubmit = this.handleSubmit.bind(this)
    this.handleServer = this.handleServer.bind(this)

    this.state = {
      entries: writable(props.entries || [])
    }
  }

  template (props) {
    return (
      <div class='discuss' data-context={props.context}>
        <ul class='discuss__entries' ref={this.ref('entries')} />
        {!props.readonly && (
          <form
            event-submit={this.handleSubmit}
            store-class-is-disabled={WebSocketServer.isClosed}
            store-class-has-author={AUTHOR}
          >
            <input
              type='text'
              ref={this.ref('author')}
              name='author'
              placeholder='nom'
              store-value={AUTHOR}
            />
            <label
              store-text={AUTHOR}
              ref={this.ref('authorLabel')}
              // Lazy way to handle author edition once stored
              event-click={e => AUTHOR.set(window.prompt('Éditer le nom', AUTHOR.current || 'Nouveau nom'))}
            />
            <textarea
              ref={this.ref('message')}
              name='message'
              placeholder='message…'
              rows='1'
              event-input={this.handleTextarea}
              event-keypress={e => e.key === 'Enter' && !e.shiftKey && this.handleSubmit(e)}
            />
            <input type='submit' value='→' />
          </form>
        )}
      </div>
    )
  }

  afterRender () {
    this.update()
    this.handleAuthor()
    AUTHOR.subscribe(this.handleAuthor)
    WebSocketServer.content.subscribe(this.handleServer)
    this.state.entries.subscribe(this.update)
  }

  update () {
    this.refs.entries.innerHTML = ''

    let previous
    for (const entry of this.state.entries.get()) {
      if (!entry.message) continue
      const html = linkify(entry.message.trim(), { target: '_blank' })

      this.render((
        <li
          class='discuss__entry'
          style={`--color: ${stringToColor(entry.author)};`}
          title={entry.timestamp && new Date(entry.timestamp)}
          data-author={previous && previous.author === entry.author ? null : entry.author}
          innerHTML={html}
        />
      ), this.refs.entries)
      previous = entry
    }

    this.refs.entries.scrollTop = this.refs.entries.scrollHeight
  }

  handleAuthor () {
    this.refs.authorLabel.style.setProperty('--color', stringToColor(AUTHOR.current))
  }

  handleTextarea (e) {
    this.refs.message.style.height = '20px'
    this.refs.message.style.height = this.refs.message.scrollHeight + 'px'
  }

  handleSubmit (e) {
    e.preventDefault()
    if (!this.refs.author.value) return
    AUTHOR.set(this.refs.author.value)

    if (!this.refs.message.value) return
    const entry = {
      context: this.props.context,
      timestamp: Date.now(),
      author: sanitize(this.refs.author.value, { allowedTags: [] }),
      message: sanitize(this.refs.message.value, { allowedTags: [] })
    }

    WebSocketServer.sendJson(entry)
    this.refs.message.value = ''
    this.handleTextarea()
  }

  handleServer (content = {}) {
    if (!content[this.props.context]) return
    this.state.entries.set(content[this.props.context])
  }

  beforeDestroy () {
    AUTHOR.unsubscribe(this.handleAuthor)
    WebSocketServer.content.unsubscribe(this.handleServer)
  }
}

function stringToColor (string, colors = ['#1f6feb', '#79c0ff', '#7ee787', '#aff5b4', '#d2a8ff', '#f2cc60', '#ff7b72', '#ffa657']) {
  if (!string) return ''

  string = string.toUpperCase()
  let hash = 0
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % (colors.length - 1)]
}
