# cahier <img src="https://em-content.zobj.net/thumbs/240/apple/325/notebook_1f4d3.png" width="100" align="right">
**Readonly markdown server w/ auth support and live chat, to assist lectures**

<br>

## Features

- **Directory listing**
- **Markdown** files rendering, with support for:
  - Emojis using `:emoji:`
  - Marked text using `==mark==`
  - Abbreviations
  - Quote attribution using `-- Attribution`
  - Footnotes
  - Code syntax highlighting
- **Front matter** for markdown documents
  - `title`
  - `description`
  - `author`, using the npm format (`Name <mail> (website)`)
  - `lang`
  - `icon`
  - `hidden`
- **Live chat** inside a document, using the `[[ discuss ]]` component
  - Stored as a `.log` file
  - Multiple contexts using `[[ discuss:contextName ]]`
  - Readonly using `[[ discuss readonly ]]`
- **Directory access control**, using a `.lock` file inside the directory
  - Global password defined as `env` variable
  - Local passwords defined inside the `.lock` file (one by line)

## Development

### Installation

```console
$ git clone https://github.com/arnaudjuracek/cahier && cd cahier
$ cp server/.env.example server/.env
$ yarn install
```

### Deployment
Deployment to the AlwaysData environment is done automatically via a [Github action](.github/workflows/deploy-alwaysdata.yml). Simply create a new release by running:

```console
$ yarn version
```

## License

[MIT.](https://tldrlegal.com/license/mit-license)

