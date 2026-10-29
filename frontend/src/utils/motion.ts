/**
 * Motion helpers built on anime.js v4.
 *
 * Rules this module enforces so motion stays a state signal rather than decoration:
 *
 * 1. Everything respects `prefers-reduced-motion`.
 * 2. **An animation can never leave content hidden.** anime.js drives rAF, and rAF
 *    is paused while the document is hidden (a background tab, a collapsed pane, a
 *    headless render). An animation that starts with `opacity: [0, 1]` therefore
 *    writes `opacity: 0` and then never advances — the panel stays blank. Every
 *    helper here checks `canAnimate()` first and jumps straight to the final state
 *    when it cannot run, and every transition that owns a state change is handed a
 *    completion callback that is guaranteed to fire.
 * 3. Durations stay in the 160–280ms band. The user is in a task, not watching a show.
 */

import { animate, utils } from 'animejs'

export const DURATION = {
  fast: 160,
  base: 220,
  slow: 280,
} as const

/** Matches --ease-out-quart in index.css, so CSS and JS motion agree. */
export const EASE = 'cubicBezier(0.22, 1, 0.36, 1)'

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

/**
 * Frame-loop heartbeat.
 *
 * `document.visibilityState` is not a reliable test for whether animation can
 * run: an occluded or non-composited window reports itself visible while rAF —
 * and therefore CSS transitions too — are parked. A transition started in that
 * state never advances and the element is stranded at its start value.
 *
 * So liveness is measured rather than assumed: if a frame has been served
 * recently, motion is armed; otherwise styles are applied with transitions
 * switched off and the element lands directly in its final state.
 */
let lastFrame = 0
if (typeof window !== 'undefined' && typeof requestAnimationFrame === 'function') {
  const pulse = (time: number) => {
    lastFrame = time
    requestAnimationFrame(pulse)
  }
  requestAnimationFrame(pulse)
}

function framesRunning(): boolean {
  if (typeof performance === 'undefined') return false
  return lastFrame > 0 && performance.now() - lastFrame < 400
}

/** Whether a transition will actually play through to its end state. */
export function canAnimate(): boolean {
  if (typeof document === 'undefined') return false
  if (document.visibilityState === 'hidden') return false
  if (prefersReducedMotion()) return false
  return framesRunning()
}

/** Apply styles with transitions suppressed, so they take effect immediately. */
function applyInstantly(element: HTMLElement, apply: () => void): void {
  const previous = element.style.transition
  element.style.transition = 'none'
  apply()
  void element.offsetHeight // commit before restoring
  element.style.transition = previous
}

const VISIBLE = { opacity: 1, x: 0, y: 0 } as const

/** Put an element in its resting, visible state immediately. */
export function settle(element: HTMLElement | null): void {
  if (!element) return
  utils.set(element, VISIBLE)
}

/**
 * Exit transition that owns a state change: the caller swaps content in `done`.
 *
 * `done` always fires — immediately when motion is unavailable, otherwise on
 * completion — so a tab can never get stuck because an animation did not run.
 */
export function exitPanel(
  element: HTMLElement | null,
  direction: number,
  done: () => void,
): void {
  if (!element || !canAnimate()) {
    done()
    return
  }

  const offset = direction === 0 ? 0 : direction > 0 ? -10 : 10

  // `visibilityState` is not a reliable test for whether rAF will actually tick:
  // an occluded or non-composited window reports itself visible while its frames
  // are parked. A watchdog guarantees the swap regardless, so a tab can never get
  // stuck behind an animation that is not running.
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    done()
  }

  animate(element, {
    opacity: [1, 0],
    x: offset,
    duration: DURATION.fast,
    ease: 'cubicBezier(0.4, 0, 1, 1)', // ease-in: accelerate away
    onComplete: finish,
  })

  window.setTimeout(finish, DURATION.fast + 120)
}

/**
 * Play a CSS enter transition on an element.
 *
 * The sequence is: apply the "from" class, force a style computation so the
 * browser has a start value to interpolate from, then remove it. Removing the
 * class yields the element's normal, visible style — so if transitions cannot
 * run, the element is simply visible immediately. Nothing can strand it hidden.
 */
function playEnter(element: HTMLElement, x: number, y: number, delay = 0): void {
  // Clear any inline state an exit tween left behind.
  utils.set(element, VISIBLE)

  if (!canAnimate()) {
    element.classList.remove('anim-from', 'anim-active')
    settle(element)
    return
  }

  element.style.setProperty('--enter-x', `${x}px`)
  element.style.setProperty('--enter-y', `${y}px`)
  element.classList.add('anim-from')

  // Forces the "from" style to be computed; without this the browser coalesces
  // both class changes into one style resolution and no transition runs.
  void element.offsetHeight

  element.style.transitionDelay = delay ? `${delay}ms` : ''
  element.classList.add('anim-active')
  element.classList.remove('anim-from')

  const clear = () => {
    element.classList.remove('anim-active')
    element.style.transitionDelay = ''
    element.style.removeProperty('--enter-x')
    element.style.removeProperty('--enter-y')
  }
  element.addEventListener('transitionend', clear, { once: true })
  window.setTimeout(clear, DURATION.base + delay + 400)
}

/**
 * Enter transition for a swapped panel. `direction` is the sign of
 * (newIndex - oldIndex), so moving right enters from the right — the tab strip
 * reads as a position in a sequence rather than a set of unrelated screens.
 */
export function enterPanel(
  element: HTMLElement | null,
  direction: number,
  options: { stagger?: boolean } = {},
): void {
  if (!element) return

  const children = Array.from(element.querySelectorAll<HTMLElement>('[data-stagger]'))

  if (!canAnimate()) {
    settle(element)
    children.forEach((child) => settle(child))
    return
  }

  const offset = direction === 0 ? 0 : direction > 0 ? 20 : -20
  playEnter(element, offset, 0)

  if (options.stagger && children.length > 1) {
    children.forEach((child, index) => playEnter(child, 0, 10, 60 + index * 45))
  } else {
    children.forEach((child) => settle(child))
  }
}

/**
 * Underline / highlight that travels between tabs.
 *
 * Measured from the DOM so it follows a resize and the distance is real, but
 * applied as CSS custom properties rather than interpolated in JS: the final
 * position is set immediately and the browser animates the move if it can. A
 * parked frame loop leaves the indicator in the right place, not stranded on
 * the previous tab.
 */
export function moveIndicator(
  indicator: HTMLElement | null,
  target: HTMLElement | null,
  container: HTMLElement | null,
  axis: 'x' | 'y' = 'x',
): void {
  if (!indicator || !target || !container) return

  const targetBox = target.getBoundingClientRect()
  const containerBox = container.getBoundingClientRect()

  // The tab strip is horizontal on narrow screens and vertical once the rail
  // appears, so the indicator travels along whichever axis the strip uses.
  const offset =
    axis === 'x' ? targetBox.left - containerBox.left : targetBox.top - containerBox.top
  const size = axis === 'x' ? targetBox.width : targetBox.height

  indicator.classList.add('indicator')

  // Only transition once it has been placed on this axis — the first placement
  // (or an axis change) must not slide in from the origin.
  const placed = indicator.dataset.placed === axis
  indicator.dataset.placed = axis
  const slide = placed && canAnimate()
  indicator.classList.toggle('indicator-move', slide)

  const write = () => {
    indicator.style.setProperty('--ind-x', axis === 'x' ? `${offset}px` : '0px')
    indicator.style.setProperty('--ind-y', axis === 'y' ? `${offset}px` : '0px')
    indicator.style.setProperty('--ind-w', axis === 'x' ? `${size}px` : '2px')
    indicator.style.setProperty('--ind-h', axis === 'y' ? `${size}px` : '2px')
    indicator.style.opacity = '1'
  }

  if (slide) write()
  else applyInstantly(indicator, write)
}

/** Route change: a short settle on the canvas. Smaller than a tab change. */
export function enterRoute(element: HTMLElement | null): void {
  if (!element) return
  if (!canAnimate()) {
    settle(element)
    return
  }
  playEnter(element, 0, 10)
}

/**
 * Count a figure up to its value. Used only where the number changing *is* the
 * information. The element always ends showing the real value.
 */
export function countTo(
  element: HTMLElement | null,
  value: number,
  format: (current: number) => string,
): void {
  if (!element) return

  if (!canAnimate()) {
    element.textContent = format(value)
    return
  }

  // The real value is written first, so a parked frame loop leaves the correct
  // figure on screen rather than a zero.
  element.textContent = format(value)

  const state = { current: 0 }
  animate(state, {
    current: value,
    duration: DURATION.slow,
    ease: EASE,
    onUpdate: () => {
      element.textContent = format(state.current)
    },
    onComplete: () => {
      element.textContent = format(value)
    },
  })
}
