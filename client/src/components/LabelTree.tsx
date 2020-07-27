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

  function onDragStart(info) {
    console.log('start', info)
  }

  function onDragEnter(info) {
    console.log('enter', info)
    setExpandedKeys(info.expandedKeys)
  }

  function onDrop(info) {
    console.log('drop', info)
    const dropKey = info.node.props.eventKey
    const dragKey = info.dragNode.props.eventKey
    const dropPos = info.node.props.pos.split('-')
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1])

    console.log(`dragKey: ${dragKey}`)
    console.log(`dropKey: ${dropKey}`)
    console.log(`dropPosition: ${dropPosition}`)
    console.log(`dropToGap: ${info.dropToGap}`)
    console.log(`expanded: ${info.node.props.expanded}`)
    console.log(`numChildren: ${info.node.props.children ? info.node.props.children.length : 0}`)

    if (!info.dropToGap) {
      // Dropped onto a TreeItem.
      console.log(`dropped`)
      const droppedFromLabel = labelState.labelsById[parseInt(dragKey)]
      const droppedToLabel = labelState.labelsById[parseInt(dropKey)]
      const updatedLabel = { ...droppedFromLabel, parent_id: droppedToLabel.id }
      dispatch({ type: 'UPDATE', payload: updatedLabel })
    }
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

  const Switcher = (props: EventDataNode) => {
    if (props.expanded) {
      return <KeyboardArrowDownIcon className="icon-button" />
    } else {
      return <ChevronRightIcon className="icon-button" />
    }
  }

  function treeData(data: TreeItem[]) {
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

  function getLabelItems(): TreeItem[] {
    const allItems: Record<number, TreeItem> = {}
    const labels: Label[] = Object.values(labelState.labelsById)

    labels.map((label) => {
      allItems[label.id] = new TreeItem(label.title, label.id, label, [])
    })

    labels.map((label) => {
      if (label.parent_id) {
        const parent = allItems[label.parent_id]
        allItems[label.id] = { ...allItems[label.id], level: parent.level + 1 }
        parent.children.push(allItems[label.id])
      }
    })

    return Object.values(allItems).filter((item) => item.level == 0)
  }

  const labelItems = getLabelItems()

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
