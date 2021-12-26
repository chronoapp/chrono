import { Label } from '../../models/Label'
import { normalizeArr } from '../../lib/normalizer'

/**
 * Existing parent id in label map.
 */
export function getParentIds(
  labelsById: Record<number, Label>,
  myLabels: Record<number, Label>,
  label: Label
): Array<number> {
  let parentId = label.parent_id
  const parentIds = new Array<number>()

  while (parentId) {
    const parentLabel = labelsById[parentId]
    if (myLabels[parentLabel.id]) {
      parentIds.push(parentLabel.id)
    }

    parentId = parentLabel.parent_id
  }

  return parentIds
}

/**
 * Adds new labelIds to the current labels list.
 * Makes sure that a parent is removed if a child is added and vice versa.
 */
export function addNewLabels(
  labelsById: Record<number, Label>,
  curLabels: Label[],
  newLabelIds: number[]
): Label[] {
  const curLabelsMap = normalizeArr(curLabels, 'id')
  let updatedLabels = curLabels // Maintain order

  for (let labelId of newLabelIds) {
    const addedLabel = labelsById[labelId]
    // Remove parents.
    const parentIds = getParentIds(labelsById, curLabelsMap, addedLabel)
    updatedLabels = updatedLabels.filter((label) => !parentIds.includes(label.id))

    // Remove children of new label.
    for (let curLabel of curLabels) {
      const parentIds = getParentIds(labelsById, labelsById, curLabel)
      if (parentIds.includes(addedLabel.id)) {
        updatedLabels = updatedLabels.filter((label) => label.id !== curLabel.id)
      }
    }

    if (!curLabelsMap.hasOwnProperty(addedLabel.id)) {
      updatedLabels.push(addedLabel)
    }
  }

  return updatedLabels
}
