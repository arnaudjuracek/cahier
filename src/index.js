import { render } from 'utils/jsx'

/// #if DEVELOPMENT
require('webpack-hot-middleware/client?reload=true')
  .subscribe(({ reload }) => reload && window.location.reload())
/// #endif

// TODO[ws]: chat using jsx components
// render(<h1>Hello</h1>, document.body)
