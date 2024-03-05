export function hexToHSL(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)

  if (!result) {
    throw new Error(`Invalid Hex string: ${hex}`)
  }

  let r = parseInt(result[1], 16)
  let g = parseInt(result[2], 16)
  let b = parseInt(result[3], 16)

  ;(r /= 255), (g /= 255), (b /= 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h: number = 0
  let s: number = 0
  let l = (max + min) / 2

  if (max == min) {
    h = s = 0 // achromatic
  } else {
    var d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  s = s * 100
  s = Math.round(s)
  l = l * 100
  l = Math.round(l)
  h = Math.round(360 * h)

  return { h, s, l }
}

export function adjustHSLABrightness(hslaColor: string, brightnessAdjustment: number) {
  // This regex matches HSLA color format, capturing the hue, saturation, lightness, and alpha values
  const parts = hslaColor.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%\s*,?\s*(\d*\.?\d+)?\)/)
  if (!parts) {
    console.error('Invalid HSLA color format:', hslaColor)
    return hslaColor // Return the original input if the format doesn't match
  }

  let [_, h, s, l, a = 1] = parts // Default alpha to 1 if not provided
  let lightness = parseInt(l, 10)

  // Adjust lightness
  lightness += brightnessAdjustment
  // Ensure lightness remains within the 0-100% range
  lightness = Math.max(0, Math.min(100, lightness))

  return `hsla(${h}, ${s}%, ${lightness}%, ${a})`
}

export function makeHSLASolid(hslaColor: string) {
  // This regex matches HSLA color format, capturing the hue, saturation, lightness, and alpha values
  const parts = hslaColor.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%\s*,?\s*(\d*\.?\d+)?\)/)
  if (!parts) {
    console.error('Invalid HSLA color format:', hslaColor)
    return hslaColor // Return the original input if the format doesn't match
  }

  let [_, h, s, l] = parts // Ignore the alpha part

  return `hsl(${h}, ${s}%, ${l}%)`
}
