/**
 * Motion helpers built on anime.js v4.
 *
 * Rules this file enforces so motion stays a state signal rather than decoration:
 *
 * 1. Everything respects `prefers-reduced-motion`. When reduced motion is on, the
 *    element is placed in its final state immediately instead of being animated.
 * 2. Content is visible by default. These helpers animate *from* a transform, they
 *    never gate visibility on an animation completing — a transition that never
 *    fires (hidden tab, headless render) must not leave a blank panel behind.
 * 3. Durations stay in the 140–260ms band. The user is in a task, not watching a show.
 */

import { animate, stagger, utils } from 'animejs'

export const DURATION = {
  fast: 140,
  base: 190,
  slow: 260,
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
 * Tab / panel change: the outgoing content is already gone (React has swapped it),
 * so this animates the incoming panel in from the direction of travel.
 *
 * `direction` is the sign of (newIndex - oldIndex), so moving right slides in from
 * the right. That makes the tab strip feel like a position in a sequence rather
 * than a set of unrelated screens.
 */
export function enterPanel(
  element: HTMLElement | null,
  direction: number,
  options: { stagger?: boolean } = {},
): void {
  if (!element) return

  if (prefersReducedMotion()) {
    utils.set(element, { opacity: 1, x: 0 })
    return
  }

  const offset = direction === 0 ? 0 : direction > 0 ? 14 : -14

  animate(element, {
    opacity: [0, 1],
    x: [offset, 0],
    duration: DURATION.base,
    ease: EASE,
  })

  if (options.stagger) {
    const children = element.querySelectorAll<HTMLElement>('[data-stagger]')
    if (children.length > 1) {
      animate(children, {
        opacity: [0, 1],
        y: [6, 0],
        duration: DURATION.base,
        delay: stagger(26, { start: 40 }),
        ease: EASE,
      })
    }
  }
}

/**
 * Underline / highlight that travels between tabs. Driven from the DOM rather than
 * CSS transitions so it can follow a resize and so the distance is real.
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
  const next =
    axis === 'x'
      ? { left: targetBox.left - containerBox.left, width: targetBox.width, top: 0, height: 2 }
      : { top: targetBox.top - containerBox.top, height: targetBox.height, left: 0, width: 2 }

  if (prefersReducedMotion()) {
    utils.set(indicator, { ...next, opacity: 1 })
    return
  }

  const placed = indicator.dataset.placed === axis
  indicator.dataset.placed = axis

  // First placement (or an axis change) should not slide in from the origin.
  if (!placed) {
    utils.set(indicator, { ...next, opacity: 0 })
    animate(indicator, { opacity: [0, 1], duration: DURATION.fast, ease: EASE })
    return
  }

  animate(indicator, { ...next, opacity: 1, duration: DURATION.base, ease: EASE })
}

/** Route change: a short settle on the page body. Deliberately smaller than a tab change. */
export function enterRoute(element: HTMLElement | null): void {
  if (!element) return

  if (prefersReducedMotion()) {
    utils.set(element, { opacity: 1, y: 0 })
    return
  }

  animate(element, {
    opacity: [0, 1],
    y: [5, 0],
    duration: DURATION.base,
    ease: EASE,
  })
}

/**
 * Count a figure up to its value. Used only for the metric strip, where the number
 * changing *is* the information. Returns the formatted string through `onUpdate`.
 */
export function countTo(
  element: HTMLElement | null,
  value: number,
  format: (current: number) => string,
): void {
  if (!element) return

  if (prefersReducedMotion()) {
    element.textContent = format(value)
    return
  }

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
