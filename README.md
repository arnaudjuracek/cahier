# cahier <img src="https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/320/apple/285/notebook_1f4d3.png" width="100" align="right">
**Readonly markdown server w/ auth support and live chat, to assist lectures**

<br>

## Features

- **Directory listing**
- **Markdown** files rendering, with support for:
  - Emojis using `:emoji:`
  - Marked text using `==mark==` syntax
  - Footnotes
  - Code syntax highlighting
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

