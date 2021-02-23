import React, { useContext, useState, useEffect, useRef } from 'react'
import { Flex, Button, Menu, MenuButton, MenuList, MenuItem, Portal } from '@chakra-ui/react'

import Tree from 'rc-tree'
import { EventDataNode, DataNode } from 'rc-tree/lib/interface'
import { FiChevronDown, FiChevronRight, FiMoreHorizontal, FiTrash, FiEdit } from 'react-icons/fi'

import clsx from 'clsx'
import Hoverable from '@/lib/Hoverable'

import { LABEL_COLORS } from '@/models/LabelColors'
import { AlertsContext } from '@/contexts/AlertsContext'
import { LabelContext, LabelContextType } from '@/contexts/LabelsContext'
import { Label } from '@/models/Label'
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

  const [selectedLabelId, setSelectedLabelId] = useState<number | undefined>(undefined)

  const labelItems = getOrderedLabels(labelState.labelsById)
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

  function LabelView(label: Label, allowEdit: boolean) {
    return () => {
      if (allowEdit) {
        return (
          <Menu isLazy={true} placement="bottom">
            {({ onClose, isOpen }) => (
              <>
                <MenuButton>
                  <div
                    style={{ backgroundColor: label.color_hex }}
                    className={clsx('event-label', allowEdit && 'event-label--hoverable')}
                  ></div>
                </MenuButton>
                {isOpen && (
                  <MenuList>
                    <ColorPicker
                      onSelectLabelColor={(color) => {
                        const updatedLabel = { ...label, color_hex: color }
                        updateLabel(updatedLabel)
                        onClose()
                      }}
                    />
                  </MenuList>
                )}
              </>
            )}
          </Menu>
        )
      } else {
        return (
          <div
            onClick={() => props.onSelect && props.onSelect(label)}
            style={{ backgroundColor: label.color_hex }}
            className={clsx('event-label', allowEdit && 'event-label--hoverable')}
          ></div>
        )
      }
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

  function treeData(data: TreeItem[], allowEdit: boolean): DataNode[] {
    const Switcher = (props: EventDataNode) => {
      if (props.expanded) {
        return <FiChevronDown size={'1.25em'} style={{ marginTop: 1 }} />
      } else {
        return <FiChevronRight size={'1.25em'} style={{ marginTop: 1 }} />
      }
    }

    return data.map((item) => {
      const curMenuExpanded = selectedLabelId == item.key

      const Title = () => {
        if (allowEdit) {
          return (
            <Hoverable>
              {(isMouseInside, onMouseEnter, onMouseLeave) => (
                <Flex
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  justifyContent="space-between"
                >
                  <span>{item.title}</span>
                  {(isMouseInside || curMenuExpanded) && (
                    <Menu isLazy placement="bottom-end">
                      <MenuButton
                        variant="unstyled"
                        color="gray.600"
                        size="sm"
                        pb="1"
                        as={Button}
                        fontWeight="normal"
                      >
                        <FiMoreHorizontal size={'1.25em'} />
                      </MenuButton>
                      <Portal>
                        <MenuList mt="-5">
                          <MenuItem
                            onClick={() => {
                              onClickEditLabel(item)
                              onMouseLeave()
                            }}
                            icon={<FiEdit />}
                            iconSpacing="1"
                          >
                            Edit
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              onDeleteLabel(item)
                              onMouseLeave()
                            }}
                            icon={<FiTrash />}
                            iconSpacing="1"
                          >
                            Delete
                          </MenuItem>
                        </MenuList>
                      </Portal>
                    </Menu>
                  )}
                </Flex>
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
