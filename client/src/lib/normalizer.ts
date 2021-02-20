/**
 * TODO: Use normalizr for state normalization?
 */
export function normalizeArr(arr: any[], key: string | number) {
  const initialValue = {}
  return arr.reduce((obj: any, item: any) => {
    return {
      ...obj,
      [item[key]]: item,
    }
  }, initialValue)
}
