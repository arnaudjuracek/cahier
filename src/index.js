import { render } from 'utils/jsx'
import Discuss from 'components/Discuss'

/// #if DEVELOPMENT
require('webpack-hot-middleware/client?reload=true')
  .subscribe(({ reload }) => reload && window.location.reload())
/// #endif

const discusses = document.querySelectorAll('script.discuss-data')
for (const data of Array.from(discusses)) {
  render((
    <Discuss
      context={data.dataset.context}
      readonly={data.hasAttribute('readonly')}
      lang={data.lang}
      entries={JSON.parse(data.innerText)}
    />
  ), el => data.parentNode.insertBefore(el, data.nextSibling))
  data.remove()
}
