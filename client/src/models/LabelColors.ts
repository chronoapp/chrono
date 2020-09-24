import tinycolor from 'tinycolor2'

export class LabelColor {
  title: string
  hex: string

  constructor(title: string, hex: string) {
    ;(this.title = title), (this.hex = hex)
  }
}

export const LABEL_COLORS = [
  new LabelColor('grey', '#f5f5f5'),
  new LabelColor('tomato', '#ff6347'),
  new LabelColor('flamingo', '#fc8eac'),
  new LabelColor('tangerine', '#f28500'),
  new LabelColor('banana', '#ffe135'),
  new LabelColor('sage', '#77815c'),
  new LabelColor('basil', '#579229'),
  new LabelColor('peacock', '#039BE5'),
  new LabelColor('blueberry', '#7986CB'),
  new LabelColor('graphite', '#616161'),
  new LabelColor('lavender', '#E6E6FA'),
  new LabelColor('grape', '#6f2da8'),
  // new LabelColor('calendar', '#7CB342'),
]

export function getSortedLabelColors() {
  return LABEL_COLORS.sort((color) => tinycolor(color.hex).getLuminance())
}
