import { createMenuGesture } from '../../../packages/menu-gesture/src/index'
import { createGestureDebugOverlay, gestureDebugEnabled } from '../../../apps/web/src/components/menu-edit/debug-overlay'
const w = window as any
w.__log = []
const root = document.querySelector<HTMLElement>('[data-menu-edit-root]')!
const dbg = gestureDebugEnabled() ? createGestureDebugOverlay(document) : null
w.__gesture = createMenuGesture({
  root, itemSelector: '[data-edit-id]', restoreDomOnDrop: false, reducedMotion: false,
  onDrop: d => w.__log.push(['drop', d]), onTap: id => w.__log.push(['tap', id]), onModeChange: e => w.__log.push(['mode', e]),
  debug: (s, d) => { w.__log.push(['dbg', s, d]); dbg?.state(s, d) },
})
