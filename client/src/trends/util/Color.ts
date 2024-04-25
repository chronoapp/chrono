function calculateColor(value, maxDuration, h, s, l) {
  if (value === 0 || maxDuration === 0) {
    return '#E0E0E0' // Default color for days with no activity
  }
  const ratio = value / maxDuration
  const remainingLight = 100 - l
  const addLight = (1 - ratio) * remainingLight
  return `hsl(${h}, ${s}%, ${l + addLight}%)`
}

export { calculateColor }
