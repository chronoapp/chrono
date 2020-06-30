import contains from 'dom-helpers/contains'
import closest from 'dom-helpers/closest'
import listen from 'dom-helpers/listen'

type SelectEvent = 'selecting' | 'beforeSelect' | 'selectStart' | 'reset' | 'select' | 'click'

const clickTolerance = 5
// const clickInterval = 250

export class EventData {
  public isTouch: boolean

  constructor(
    readonly clientX: number,
    readonly clientY: number,
    readonly x: number,
    readonly y: number,
    isTouch: boolean = false
  ) {
    this.isTouch = isTouch
  }
}

export class Rect {
  constructor(
    readonly top: number,
    readonly left: number,
    readonly right: number,
    readonly bottom: number
  ) {}
}

/**
 * We need x and y to know the end position.
 */
export class SelectRect extends Rect {
  constructor(
    top: number,
    left: number,
    readonly x: number,
    readonly y,
    right: number,
    bottom: number
  ) {
    super(top, left, right, bottom)
  }
}

/**
 * Adds event listener and returns function that removes the handler.
 */
declare var document: any
function addEventListener(type, handler, target = document): () => void {
  return listen(target, type, handler, { passive: false })
}

function isOverContainer(container, x, y) {
  const element = document.elementFromPoint(x, y)
  return !container || (element && contains(container, element))
}

export function getEventNodeFromPoint(node, clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY)
  if (target) {
    return closest(target, '.cal-event', node)
  }
}

export function isEvent(node, clientX, clientY) {
  return !!getEventNodeFromPoint(node, clientX, clientY)
}

/**
 * Given a node, get everything needed to calculate its boundaries
 */
export function getBoundsForNode(node: HTMLElement): Rect {
  const pageOffsetLeft = window.pageXOffset || document.body.scrollLeft || 0
  const pageOffsetTop = window.pageYOffset || document.body.scrollTop || 0

  const rect = node.getBoundingClientRect()
  const left = rect.left + pageOffsetLeft
  const top = rect.top + pageOffsetTop

  return new Rect(top, left, (node.offsetWidth || 0) + left, (node.offsetHeight || 0) + top)
}

export function objectsCollide(rectA: Rect, rectB: Rect, tolerance = 0) {
  return !(
    // 'a' bottom doesn't touch 'b' top
    (
      rectA.bottom - tolerance < rectB.top ||
      // 'a' top doesn't touch 'b' bottom
      rectA.top + tolerance > rectB.bottom ||
      // 'a' right doesn't touch 'b' left
      rectA.right - tolerance < rectB.left ||
      // 'a' left doesn't touch 'b' right
      rectA.left + tolerance > rectB.right
    )
  )
}

// Return Point
function getEventCoordinates(e): EventData {
  let target = e

  if (e.touches && e.touches.length) {
    target = e.touches[0]
  }

  return new EventData(
    target.clientX,
    target.clientY,
    target.pageX,
    target.pageY,
    /^touch/.test(e.type)
  )
}

/**
 * Wrapper over mouse and key listeners to provide higher level Selection events.
 */
export class Selection {
  private isDetached
  private container: HTMLElement
  private listeners: Record<SelectEvent, any[]> // TODO: Add typing for funcs

  private selecting = false
  private initialEventData?: EventData
  private selectRect?: SelectRect
  private lastClickTime?: number

  // Listeners
  private removeInitialEventListener
  private removeEndListener
  private removeMoveListener
  private onEscListener

  constructor(node: HTMLElement) {
    this.container = node
    this.isDetached = false

    this.handleInitialEvent = this.handleInitialEvent.bind(this)
    this.handleMoveEvent = this.handleMoveEvent.bind(this)
    this.handleTerminatingEvent = this.handleTerminatingEvent.bind(this)

    this.addInitialEventHandlers()
    this.listeners = Object.create(null)
  }

  /**
   * Listens for select events.
   */
  public on(type: SelectEvent, handler) {
    const handlers = this.listeners[type] || (this.listeners[type] = [])
    handlers.push(handler)

    return {
      remove() {
        const idx = handlers.indexOf(handler)
        if (idx !== -1) handlers.splice(idx, 1)
      },
    }
  }

  public teardown() {
    this.isDetached = true
    if (this.onEscListener) this.onEscListener()
  }

  public isSelected(node: HTMLElement) {
    const box = this.selectRect

    if (!box || !this.selecting) return false

    return objectsCollide(box, getBoundsForNode(node))
  }

  private emit(type: SelectEvent, ...args): boolean {
    let result
    const handlers = this.listeners[type] || []
    handlers.forEach((fn) => {
      if (result === undefined) {
        result = fn(...args)
      }
    })

    return result
  }

  /** Listen for mousedown and touchstart events. When one is received, disable the other and setup
   * future event handling based on the type of event.
   */
  private addInitialEventHandlers() {
    const removeMouseDownListener = addEventListener('mousedown', (e) => {
      this.removeInitialEventListener()
      this.handleInitialEvent(e)
      this.removeInitialEventListener = addEventListener('mousedown', this.handleInitialEvent)
    })

    this.removeInitialEventListener = () => {
      removeMouseDownListener()
      // removeTouchStartListener()
    }
  }

  private handleInitialEvent(e) {
    if (this.isDetached) {
      return
    }

    const eventData = getEventCoordinates(e)

    // Right clicks
    if (
      e.which === 3 ||
      e.button === 2 ||
      !isOverContainer(this.container, eventData.clientX, eventData.clientY)
    ) {
      return
    }

    const result = this.emit('beforeSelect', (this.initialEventData = eventData))

    if (result === false) return

    switch (e.type) {
      case 'mousedown':
        this.removeEndListener = addEventListener('mouseup', this.handleTerminatingEvent)
        this.onEscListener = addEventListener('keydown', this.handleTerminatingEvent)
        this.removeMoveListener = addEventListener('mousemove', this.handleMoveEvent)
        break
    }
  }

  private handleTerminatingEvent(e) {
    const { x, y } = getEventCoordinates(e)

    this.selecting = false
    if (this.removeEndListener) this.removeEndListener()
    if (this.removeMoveListener) this.removeMoveListener()

    if (!this.initialEventData) return

    const inRoot = contains(this.container, e.target)
    const click = this.isClick(x, y)

    this.initialEventData = undefined

    if (e.key === 'Escape') {
      return this.emit('reset')
    }

    if (click && inRoot) {
      return this.handleClickEvent(e)
    }

    if (!click) {
      return this.emit('select', this.selectRect)
    }
  }

  private handleClickEvent(e) {
    const coords = getEventCoordinates(e)

    // TODO: Handle doubleclick by storing last click timestamp.
    this.emit('click', coords)
  }

  private handleMoveEvent(e) {
    if (!this.initialEventData || this.isDetached) {
      return
    }

    const curEvent = getEventCoordinates(e)
    const w = Math.abs(this.initialEventData.x - curEvent.x)
    const h = Math.abs(this.initialEventData.y - curEvent.y)

    const left = Math.min(this.initialEventData.x, curEvent.x)
    const top = Math.min(this.initialEventData.y, curEvent.y)
    const old = this.selecting

    // Prevent emitting selectStart event until mouse is moved.
    // in Chrome on Windows, mouseMove event may be fired just after mouseDown event.
    if (this.isClick(curEvent.x, curEvent.y) && !old && !(w || h)) {
      return
    }

    this.selecting = true
    this.selectRect = new SelectRect(top, left, curEvent.x, curEvent.y, left + w, top + h)

    if (!old) {
      this.emit('selectStart', this.initialEventData)
    }

    if (!this.isClick(curEvent.x, curEvent.y)) {
      this.emit('selecting', this.selectRect)
    }

    e.preventDefault()
  }

  private isClick(pageX, pageY) {
    if (!this.initialEventData) return false
    const event = this.initialEventData

    return (
      !event.isTouch &&
      Math.abs(pageX - event.x) <= clickTolerance &&
      Math.abs(pageY - event.y) <= clickTolerance
    )
  }
}
