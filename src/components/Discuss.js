import { Component } from 'utils/jsx'
import { writable } from 'utils/state'
import WebSocket from 'reconnectingwebsocket'
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
    this.socket = new WebSocket(window.location.href.replace('http', 'ws').replace(/(#.*)$/, ''))
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

const I18n = {
  fr: {
    'author.placeholder': 'Nom…',
    'author.edit': 'Éditer le nom',
    'author.default': 'Nouveau nom',
    'textarea.placeholder': 'message…'
  },
  en: {
    'author.placeholder': 'Name…',
    'author.edit': 'Edit name',
    'author.default': 'New name',
    'textarea.placeholder': 'message…'
  }
}

export default class Discuss extends Component {
  beforeRender (props) {
    this.update = this.update.bind(this)
    this.handleAuthor = this.handleAuthor.bind(this)
    this.handleTextarea = this.handleTextarea.bind(this)
    this.handleSubmit = this.handleSubmit.bind(this)
    this.handleServer = this.handleServer.bind(this)

    this.state = {
      lang: props.lang || 'en',
      entries: writable(props.entries || [])
    }
  }

  template (props, state) {
    return (
      <div class='discuss' data-context={props.context}>
        <ul class='discuss__entries' ref={this.ref('entries')} />
        {!props.readonly && (
          <form
            event-submit={this.handleSubmit}
            store-class-is-disabled={WebSocketServer.isClosed}
            store-class-has-author={AUTHOR}
          >
            <label
              store-text={AUTHOR}
              ref={this.ref('authorLabel')}
              placeholder={I18n[state.lang]['author.placeholder']}
              event-click={e => {
                let prompt = window.prompt(I18n[state.lang]['author.edit'], AUTHOR.current || I18n[state.lang]['author.default'])
                prompt = prompt.trim()
                if (!prompt) prompt = AUTHOR.current
                AUTHOR.set(prompt)
              }}
            />
            <textarea
              ref={this.ref('message')}
              name='message'
              placeholder={I18n[state.lang]['textarea.placeholder']}
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

  afterMount () {
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
    if (!this.mounted) return
    if (!this.refs.authorLabel) return
    this.refs.authorLabel.style.setProperty('--color', stringToColor(AUTHOR.current))
  }

  handleTextarea (e) {
    this.refs.message.style.height = '20px'
    this.refs.message.style.height = this.refs.message.scrollHeight + 'px'
  }

  handleSubmit (e) {
    e.preventDefault()
    const author = AUTHOR.get()
    if (!author) return

    if (!this.refs.message.value) return
    const entry = {
      context: this.props.context,
      timestamp: Date.now(),
      author: sanitize(author, { allowedTags: [] }),
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
