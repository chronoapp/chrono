/**
 * TODO: Use normalizr for state normalization?
 */
export function normalizeArr(arr, key) {
  const initialValue = {}
  return arr.reduce((obj, item) => {
    return {
      ...obj,
      [item[key]]: item,
    }
  }, initialValue)
}
