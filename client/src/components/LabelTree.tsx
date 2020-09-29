import React, { useContext, useState, useEffect, useRef } from 'react'
import Tree from 'rc-tree'
import { EventDataNode, DataNode } from 'rc-tree/lib/interface'
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown'
import ChevronRightIcon from '@material-ui/icons/ChevronRight'
import Icon from '@mdi/react'
import { mdiDotsHorizontal, mdiDeleteOutline, mdiPencilOutline } from '@mdi/js'
import clsx from 'clsx'

import { LABEL_COLORS } from '../models/LabelColors'
import { AlertsContext } from '../components/AlertsContext'
import Hoverable from '../lib/Hoverable'
import { LabelContext, LabelContextType } from './LabelsContext'
import { Label } from '../models/Label'
import ColorPicker from './ColorPicker'

import { getAuthToken, putLabel, putLabels, deleteLabel } from '../util/Api'

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
  const alertsContext = useContext(AlertsContext)
  const { labelState, dispatch } = useContext<LabelContextType>(LabelContext)
  const [expandedKeys, setExpandedKeys] = useState([])
  const [autoExpandParent, setAutoExpandParent] = useState(false)

  const colorPickerRef = useRef<HTMLDivElement>(null)
  const labelOptionsRef = useRef<HTMLDivElement>(null)
  const [selectedLabelId, setSelectedLabelId] = useState<number | undefined>(undefined)
  const [selectedLabelIdForColor, setSelectedLabelIdForColor] = useState<number | undefined>(
    undefined
  )
  const labelItems = getOrderedLabels()

  function handleClickOutside(event) {
    if (labelOptionsRef.current && !labelOptionsRef.current?.contains(event.target)) {
      setSelectedLabelId(undefined)
    }

    if (colorPickerRef.current && !colorPickerRef.current?.contains(event.target)) {
      setSelectedLabelIdForColor(undefined)
    }
  }

  useEffect(() => {
    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  })

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
    const tagUpdates: Record<number, Label> = {}
    findLabelData(labelItems, dragKey, function (item, index, arr) {
      arr.splice(index, 1)
      draggedFrom = item

      arr.forEach((item, idx) => {
        tagUpdates[item.label.id] = { ...item.label, position: idx }
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
        tagUpdates[updatedLabel.id] = updatedLabel
        // dispatch({ type: 'UPDATE', payload: updatedLabel })
      })
    } else {
      // Dragged beside a node (top or bottom).
      let droppedToItem!: TreeItem
      findLabelData(labelItems, dropKey, (item, index, arr) => {
        droppedToItem = item

        if (dropPosition === -1) {
          // Dragged to top of node
          arr.splice(index, 0, draggedFrom)
          arr.forEach((item, idx) => {
            tagUpdates[item.label.id] = { ...item.label, position: idx }
          })
        } else {
          // Dragged to bottom of node
          arr.splice(index + 1, 0, draggedFrom)
          arr.forEach((item, idx) => {
            tagUpdates[item.label.id] = { ...item.label, position: idx }
          })
        }
      })

      const fromId = draggedFrom.label.id
      if (tagUpdates[fromId]) {
        tagUpdates[fromId] = {
          ...tagUpdates[fromId],
          parent_id: droppedToItem.label.parent_id,
        }
      }
    }

    dispatch({ type: 'UPDATE_MULTI', payload: tagUpdates })
    putLabels(Object.values(tagUpdates), getAuthToken())
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
      document.removeEventListener('click', handleClickOutside)
      setSelectedLabelIdForColor(labelId)
      document.addEventListener('click', handleClickOutside)
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
          {label.id === selectedLabelIdForColor && (
            <ColorPicker
              ref={colorPickerRef}
              onSelectLabelColor={(color) => onSelectLabelColor(color, label)}
            />
          )}
        </div>
      )
    }
  }

  function treeData(data: TreeItem[]): DataNode[] {
    const Switcher = (props: EventDataNode) => {
      if (props.expanded) {
        return <KeyboardArrowDownIcon />
      } else {
        return <ChevronRightIcon />
      }
    }

    return data.map((item) => {
      const curMenuExpanded = selectedLabelId == item.key

      const Title = () => (
        <Hoverable>
          {(isMouseInside, onMouseEnter, onMouseLeave) => (
            <div
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              style={{ display: 'flex', justifyContent: 'space-between' }}
            >
              <span>{item.title}</span>
              {(isMouseInside || curMenuExpanded) && (
                <div className={clsx('dropdown', curMenuExpanded && 'is-active')}>
                  <div
                    className="dropdown-trigger"
                    onClick={(e) => {
                      // HACK: In react 17, use e.stopPropagation()
                      document.removeEventListener('click', handleClickOutside)
                      if (curMenuExpanded) {
                        setSelectedLabelId(undefined)
                      } else {
                        setSelectedLabelId(item.key)
                      }
                      document.addEventListener('click', handleClickOutside)
                    }}
                  >
                    <Icon path={mdiDotsHorizontal} size={1} />
                  </div>
                  {curMenuExpanded && (
                    <div
                      ref={labelOptionsRef}
                      className="dropdown-menu"
                      role="menu"
                      style={{ marginTop: '-0.5rem' }}
                    >
                      <div className="dropdown-content">
                        <a
                          className="dropdown-item"
                          style={{ display: 'flex' }}
                          onClick={() => {
                            const labelColor = LABEL_COLORS.find(
                              (color) => color.hex == item.label.color_hex
                            )
                            dispatch({
                              type: 'UPDATE_EDIT_LABEL',
                              payload: {
                                ...labelState.editingLabel,
                                active: true,
                                labelId: item.key,
                                labelTitle: item.title,
                                labelColor: labelColor,
                              },
                            })
                          }}
                        >
                          <Icon path={mdiPencilOutline} size={0.8} className="mr-1" /> Edit
                        </a>
                        <a
                          className="dropdown-item"
                          style={{ display: 'flex' }}
                          onClick={() => {
                            dispatch({ type: 'DELETE', payload: item.key })
                            deleteLabel(item.key, getAuthToken()).then((r) => {
                              alertsContext.addMessage(`Tag ${item.title} deleted.`)
                            })
                          }}
                        >
                          <Icon path={mdiDeleteOutline} size={0.8} className="mr-1" /> Delete
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Hoverable>
      )

      if (item.children && item.children.length) {
        return {
          switcherIcon: Switcher,
          key: item.key,
          icon: Label(item.label),
          title: Title,
          children: treeData(item.children),
        }
      }
      return {
        key: item.key,
        icon: Label(item.label),
        title: Title,
      }
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

    // Create ordered labels array based on positioning
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
      treeData={treeData(labelItems)}
    />
  )
}

export default LabelTree
