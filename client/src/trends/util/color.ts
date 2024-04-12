function extractLightness(hslColor) {
  // HSL format is "hsl(hue, saturation%, lightness%)"
  const parts = hslColor
    .substring(4, hslColor.length - 1)
    .replace(/%/g, '')
    .split(',')
  return parseFloat(parts[2]) // parts[2] is the lightness component
}
function interpolateLightness(hslColor1, hslColor2) {
  // Extract lightness values from each HSL color
  const lightness1 = extractLightness(hslColor1)
  const lightness2 = extractLightness(hslColor2)

  // Calculate the average lightness
  const averageLightness = (lightness1 + lightness2) / 2

  // Assuming the hue and saturation are the same for both colors
  const hue = hslColor1.substring(4, hslColor1.indexOf(','))
  const saturation = hslColor1.substring(hslColor1.indexOf(',') + 2, hslColor1.lastIndexOf(','))

  // Return the new HSL color with interpolated lightness
  return `hsl(${hue}, ${saturation}, ${averageLightness}%)`
}
function calculateColor(value, maxDuration, h, s, l) {
  if (value === 0 || maxDuration === 0) {
    return '#E0E0E0' // Default color for days with no activity
  }
  const ratio = value / maxDuration
  const remainingLight = 100 - l
  const addLight = (1 - ratio) * remainingLight
  return `hsl(${h}, ${s}%, ${l + addLight}%)`
}

export { interpolateLightness, calculateColor }
