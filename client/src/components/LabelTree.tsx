import React, { useContext, useState } from 'react'
import Tree, { TreeNode } from 'rc-tree'
import { EventDataNode } from 'rc-tree/lib/interface'
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown'
import ChevronRightIcon from '@material-ui/icons/ChevronRight'

import { LabelContext, LabelContextType } from './LabelsContext'
import { Label } from '../models/Label'
import ColorPicker from './ColorPicker'

import { getAuthToken, putLabel } from '../util/Api'

class TreeItem {
  constructor(
    readonly title: string,
    readonly key: number,
    readonly label: Label,
    readonly children: TreeItem[],
    readonly position: number,
    readonly level = 0
  ) {}
}

function LabelTree() {
  const { labelState, dispatch } = useContext<LabelContextType>(LabelContext)
  const [expandedKeys, setExpandedKeys] = useState([])
  const [autoExpandParent, setAutoExpandParent] = useState(false)

  const [selectedLabelIdForColor, setSelectedLabelIdForColor] = useState<number | undefined>(
    undefined
  )
  const labelItems = getOrderedLabels()

  function onDragStart(info) {
    console.log('start', info)
  }

  function onDragEnter(info) {
    console.log('enter', info)
    setExpandedKeys(info.expandedKeys)
  }

  function onDrop(info) {
    console.log('---onDrop---')
    console.log(info)

    const dragKey = info.dragNode.props.eventKey
    const dropKey = info.node.props.eventKey
    const dropPos = info.node.props.pos.split('-')
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1])

    const findLabelData = (
      data: TreeItem[],
      key: string,
      callback: (item: TreeItem, idx: number, arr: TreeItem[]) => void
    ) => {
      data.forEach((item, index, arr) => {
        if (item.key === parseInt(key)) {
          callback(item, index, arr)
          return
        }
        if (item.children) {
          findLabelData(item.children, key, callback)
        }
      })
    }

    // Label Id to Position
    let draggedFrom!: TreeItem
    const positionUpdates: Record<number, number> = {}
    findLabelData(labelItems, dragKey, function (item, index, arr) {
      arr.splice(index, 1)
      draggedFrom = item

      arr.forEach((item, idx) => {
        positionUpdates[item.key] = idx
      })
    })

    if (!info.dropToGap) {
      // Dropped onto a TreeItem.
      console.log(`dropped`)
      findLabelData(labelItems, dropKey, (item, idx, arr) => {
        const updatedLabel = {
          ...draggedFrom.label,
          parent_id: parseInt(dropKey),
          position: item.children.length,
        }
        dispatch({ type: 'UPDATE', payload: updatedLabel })
      })
    } else {
      // Dragged beside a node (top or bottom).
      let updatedLabel!: Label
      findLabelData(labelItems, dropKey, (item, index, arr) => {
        updatedLabel = { ...draggedFrom.label, parent_id: item.label.parent_id }

        if (dropPosition === -1) {
          // Dragged to top of node
          arr.splice(index, 0, draggedFrom)
          arr.forEach((item, idx) => {
            positionUpdates[item.key] = idx
          })
        } else {
          // Dragged to bottom of node
          arr.splice(index + 1, 0, draggedFrom)
          arr.forEach((item, idx) => {
            positionUpdates[item.key] = idx
          })
        }
      })

      if (updatedLabel) {
        dispatch({ type: 'UPDATE', payload: updatedLabel })
      }
    }

    dispatch({ type: 'UPDATE_POSITIONS', payload: positionUpdates })

    // TODO: API Request to update positions
  }

  function onExpand(expandedKeys) {
    setExpandedKeys(expandedKeys)
    setAutoExpandParent(false)
  }

  async function updateLabel(label: Label) {
    const authToken = getAuthToken()
    const updatedLabel = await putLabel(label, authToken)
    dispatch({
      type: 'UPDATE',
      payload: updatedLabel,
    })
  }

  function toggleSelectedLabelId(labelId: number) {
    if (labelId == selectedLabelIdForColor) {
      setSelectedLabelIdForColor(undefined)
    } else {
      setSelectedLabelIdForColor(labelId)
    }
  }

  function onSelectLabelColor(color: string, label: Label) {
    const updatedLabel = { ...label, color_hex: color }
    updateLabel(updatedLabel)
    setSelectedLabelIdForColor(undefined)
  }

  function Label(label: Label) {
    return () => {
      return (
        <div className={`dropdown ${label.id === selectedLabelIdForColor ? 'is-active' : ''}`}>
          <div
            onClick={(_) => toggleSelectedLabelId(label.id)}
            style={{ backgroundColor: label.color_hex }}
            className="event-label event-label--hoverable dropdown-trigger"
          ></div>
          {label.id === selectedLabelIdForColor ? (
            <ColorPicker onSelectLabelColor={(color) => onSelectLabelColor(color, label)} />
          ) : null}
        </div>
      )
    }
  }

  function treeData(data: TreeItem[]) {
    const Switcher = (props: EventDataNode) => {
      if (props.expanded) {
        return <KeyboardArrowDownIcon />
      } else {
        return <ChevronRightIcon />
      }
    }

    return data.map((item) => {
      if (item.children && item.children.length) {
        const Title = () => <span>{item.title}</span>
        return (
          <TreeNode switcherIcon={Switcher} key={item.key} icon={Label(item.label)} title={Title}>
            {treeData(item.children)}
          </TreeNode>
        )
      }
      return <TreeNode key={item.key} icon={Label(item.label)} title={item.title}></TreeNode>
    })
  }

  function orderTree(treeItems: TreeItem[]) {
    const orderedLabels = treeItems.sort((a, b) => a.position - b.position)
    orderedLabels.map((item) => {
      if (item.children && item.children.length > 0) {
        return { ...item, children: orderTree(item.children) }
      } else {
        return item
      }
    })
    return orderedLabels
  }

  function getOrderedLabels(): TreeItem[] {
    const allItems: Record<number, TreeItem> = {}
    const labels: Label[] = Object.values(labelState.labelsById)

    // Create a Tree structure
    labels.map((label) => {
      allItems[label.id] = new TreeItem(label.title, label.id, label, [], label.position)
    })

    labels.map((label) => {
      if (label.parent_id) {
        const parent = allItems[label.parent_id]
        allItems[label.id] = { ...allItems[label.id], level: parent.level + 1 }
        parent.children.push(allItems[label.id])
      }
    })

    // Create ordered albels array based on positioning
    const rootItems = Object.values(allItems).filter((item) => item.level == 0)
    return orderTree(rootItems)
  }

  return (
    <Tree
      expandedKeys={expandedKeys}
      onExpand={onExpand}
      autoExpandParent={autoExpandParent}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDrop={onDrop}
    >
      {treeData(labelItems)}
    </Tree>
  )
}

export default LabelTree
