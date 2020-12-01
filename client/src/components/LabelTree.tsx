import React, { useContext, useState, useEffect, useRef } from 'react'
import Tree from 'rc-tree'
import { EventDataNode, DataNode } from 'rc-tree/lib/interface'
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown'
import ChevronRightIcon from '@material-ui/icons/ChevronRight'
import Icon from '@mdi/react'
import { mdiDotsHorizontal, mdiDeleteOutline, mdiPencilOutline } from '@mdi/js'
import clsx from 'clsx'
import Popover from '../lib/popover/Popover'
import Hoverable from '../lib/Hoverable'

import { LABEL_COLORS } from '../models/LabelColors'
import { AlertsContext } from '../components/AlertsContext'
import { LabelContext, LabelContextType } from './LabelsContext'
import { Label } from '../models/Label'
import ColorPicker from './ColorPicker'

import { getAuthToken, putLabel, putLabels, deleteLabel } from '../util/Api'

interface IProps {
  allowEdit: boolean
  onSelect?: (label: Label) => void
}

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

function usePrevious(value) {
  const ref = useRef()
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

function LabelTree(props: IProps) {
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

  const labelItems = getOrderedLabels(labelState.labelsById)

  function handleClickOutside(event) {
    if (labelOptionsRef.current && !labelOptionsRef.current?.contains(event.target)) {
      setSelectedLabelId(undefined)
    }

    if (colorPickerRef.current && !colorPickerRef.current?.contains(event.target)) {
      setSelectedLabelIdForColor(undefined)
    }
  }

  function handleKeyboardShortcuts(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      setSelectedLabelId(undefined)
      setSelectedLabelIdForColor(undefined)
    }
  }

  useEffect(() => {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeyboardShortcuts)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleKeyboardShortcuts)
    }
  })

  const prevEditLabelModalOpen = usePrevious(labelState.editingLabel.active)
  useEffect(() => {
    if (prevEditLabelModalOpen && !labelState.editingLabel.active) {
      setSelectedLabelId(undefined)
    }
  }, [labelState.editingLabel.active])

  function onDragStart(info) {
    console.log('start', info)
  }

  function onDragEnter(info) {
    setExpandedKeys(info.expandedKeys)
  }

  function onDrop(info) {
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

  function LabelView(label: Label, allowEdit: boolean) {
    return () => {
      const selectedLabel = label.id === selectedLabelIdForColor

      return (
        <div className={clsx('dropdown', selectedLabel && 'is-active')}>
          <Popover
            content={() => (
              <ColorPicker
                ref={colorPickerRef}
                onSelectLabelColor={(color) => onSelectLabelColor(color, label)}
              />
            )}
            isOpen={selectedLabel}
            position={['bottom', 'right']}
            align={'start'}
          >
            <div
              onClick={() => {
                setSelectedLabelId(undefined)
                if (allowEdit) {
                  toggleSelectedLabelId(label.id)
                } else {
                  props.onSelect && props.onSelect(label)
                }
              }}
              style={{ backgroundColor: label.color_hex }}
              className={clsx(
                'event-label',
                allowEdit && 'event-label--hoverable',
                'dropdown-trigger'
              )}
            ></div>
          </Popover>
        </div>
      )
    }
  }

  function onDeleteLabel(item: TreeItem) {
    dispatch({ type: 'DELETE', payload: item.key })
    deleteLabel(item.key, getAuthToken()).then((r) => {
      alertsContext.addMessage(`Tag ${item.title} deleted.`)
    })
  }

  function onClickEditLabel(item: TreeItem) {
    const labelColor = LABEL_COLORS.find((color) => color.hex == item.label.color_hex)
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
  }

  function onClickDropdown(curMenuExpanded: boolean, item: TreeItem) {
    setSelectedLabelIdForColor(undefined)
    // HACK: In react 17, use e.stopPropagation()
    document.removeEventListener('click', handleClickOutside)
    if (curMenuExpanded) {
      setSelectedLabelId(undefined)
    } else {
      setSelectedLabelId(item.key)
    }
    document.addEventListener('click', handleClickOutside)
  }

  function renderDropdownMenu(item: TreeItem) {
    return (
      <div
        ref={labelOptionsRef}
        className="dropdown-menu"
        role="menu"
        style={{ marginTop: '-0.5rem', display: 'block', position: 'unset' }}
      >
        <div className="dropdown-content">
          <a
            className="dropdown-item"
            style={{ display: 'flex' }}
            onClick={() => onClickEditLabel(item)}
          >
            <Icon path={mdiPencilOutline} size={0.8} className="mr-1" /> Edit
          </a>
          <a
            className="dropdown-item"
            style={{ display: 'flex' }}
            onClick={() => onDeleteLabel(item)}
          >
            <Icon path={mdiDeleteOutline} size={0.8} className="mr-1" /> Delete
          </a>
        </div>
      </div>
    )
  }

  function treeData(data: TreeItem[], allowEdit: boolean): DataNode[] {
    const Switcher = (props: EventDataNode) => {
      if (props.expanded) {
        return <KeyboardArrowDownIcon />
      } else {
        return <ChevronRightIcon />
      }
    }

    return data.map((item) => {
      const curMenuExpanded = selectedLabelId == item.key

      const Title = () => {
        if (allowEdit) {
          return (
            <Hoverable>
              {(isMouseInside, onMouseEnter, onMouseLeave) => (
                <div
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <span>{item.title}</span>
                  {(isMouseInside || curMenuExpanded) && (
                    <div className={clsx('dropdown')}>
                      <Popover
                        content={() => renderDropdownMenu(item)}
                        isOpen={curMenuExpanded}
                        align={'start'}
                        padding={-5}
                        position={['bottom']}
                      >
                        <div
                          className="dropdown-trigger"
                          onClick={(e) => onClickDropdown(curMenuExpanded, item)}
                        >
                          <Icon path={mdiDotsHorizontal} size={1} />
                        </div>
                      </Popover>
                    </div>
                  )}
                </div>
              )}
            </Hoverable>
          )
        } else {
          return (
            <span
              style={{ display: 'inline-block' }}
              className="pl-1"
              onClick={() => props.onSelect && props.onSelect(item.label)}
            >
              {item.title}
            </span>
          )
        }
      }

      if (item.children && item.children.length) {
        return {
          switcherIcon: Switcher,
          key: item.key,
          icon: LabelView(item.label, allowEdit),
          title: Title,
          children: treeData(item.children, allowEdit),
        }
      }
      return {
        key: item.key,
        icon: LabelView(item.label, allowEdit),
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

  function getOrderedLabels(labelsById: Record<number, Label>): TreeItem[] {
    const allItems: Record<number, TreeItem> = {}
    const labels: Label[] = Object.values(labelsById)

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
      treeData={treeData(labelItems, props.allowEdit)}
    />
  )
}

export default LabelTree
