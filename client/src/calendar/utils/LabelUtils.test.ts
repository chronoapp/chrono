import { getParentIds, addNewLabels } from './LabelUtils'
import { normalizeArr } from '../../lib/normalizer'
import { Label } from '../../models/Label'

// l1 is parent of both l2 and l3
const l1 = new Label(1, 'Label 1', 'label-1', '#fff', 1, undefined)
const l2 = new Label(2, 'Label 2', 'label-2', '#fff', 2, 1)
const l3 = new Label(3, 'Label 3', 'label-3', '#fff', 3, 1)

test('getParentIds empty input', () => {
  const result = getParentIds([], [], l1)
  expect(result.length).toBe(0)
})

test('getParentIds return parent id', () => {
  const labels = normalizeArr([l1, l2, l3], 'id')
  const myLabels = normalizeArr([l1, l2], 'id')

  const result = getParentIds(labels, myLabels, l3)
  expect(result[0]).toBe(1)
})

test('addNewLabels adds new label', () => {
  const allLabels = normalizeArr([l1, l2, l3], 'id')
  const myLabels = [l2]

  const result = addNewLabels(allLabels, myLabels, [l3.id])
  expect(result[0].id).toBe(2)
  expect(result[1].id).toBe(3)
})

test('addNewLabels overrides parent', () => {
  const allLabels = normalizeArr([l1, l2, l3], 'id')
  const myLabels = [l1]

  const result = addNewLabels(allLabels, myLabels, [l2.id])
  expect(result.length).toBe(1)
  expect(result[0].id).toBe(l2.id)
})

test('addNewLabels parent overrides child', () => {
  const allLabels = normalizeArr([l1, l2, l3], 'id')
  const myLabels = [l2]

  const result = addNewLabels(allLabels, myLabels, [l1.id])
  expect(result.length).toBe(1)
  expect(result[0].id).toBe(l1.id)
})
