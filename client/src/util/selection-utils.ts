import { Rect } from './Selection'

export function slotWidth(rowBox, slots: number) {
  let rowWidth = rowBox.right - rowBox.left
  let cellWidth = rowWidth / slots

  return cellWidth
}

export function getSlotAtX(rowBox: Rect, x: number, rtl: boolean, slots: number): number {
  const cellWidth = slotWidth(rowBox, slots)
  return rtl
    ? slots - 1 - Math.floor((x - rowBox.left) / cellWidth)
    : Math.floor((x - rowBox.left) / cellWidth)
}

export function pointInBox(box: Rect, x: number, y: number) {
  return y >= box.top && y <= box.bottom && x >= box.left && x <= box.right
}
