import React, { useState, useEffect, useRef } from 'react'
import { useRecoilState } from 'recoil'
import produce from 'immer'

import {
  Text,
  Flex,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Portal,
  useToast,
} from '@chakra-ui/react'

import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react'

import Tree, { TreeNodeProps } from 'rc-tree'
import { DataNode } from 'rc-tree/lib/interface'
import { FiChevronDown, FiChevronRight, FiMoreHorizontal, FiTrash, FiEdit } from 'react-icons/fi'
import Hoverable from '@/lib/Hoverable'

import { LABEL_COLORS } from '@/models/LabelColors'
import { InfoAlert } from '@/components/Alert'
import { Label } from '@/models/Label'
import ColorPicker from './ColorPicker'
import { LabelTagColor } from './LabelTag'

import * as API from '@/util/Api'
import { labelsState } from '@/state/LabelsState'

interface IProps {
  allowEdit: boolean
  onSelect?: (label: Label) => void
}

class TreeItem {
  constructor(
    readonly title: string,
    readonly key: string,
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
  const [labelState, setLabelState] = useRecoilState(labelsState)
  const toast = useToast()

  const [expandedKeys, setExpandedKeys] = useState([])
  const [autoExpandParent, setAutoExpandParent] = useState(false)

  const labelItems = getOrderedLabels(labelState.labelsById)
  const prevEditLabelModalOpen = usePrevious(labelState.editingLabel.active)

  const [selectedLabelId, setSelectedLabelId] = useState<string | undefined>(undefined)
  const confirmDeleteCancelRef = React.useRef<HTMLButtonElement>(null)
  const [confirmDeleteLabel, setConfirmDeleteLabel] = React.useState<Label | undefined>(undefined)

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
        if (item.key === key) {
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
      findLabelData(labelItems, dropKey, (item, idx, arr) => {
        const updatedLabel = {
          ...draggedFrom.label,
          parent_id: dropKey,
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

    setLabelState((labelState) => {
      return {
        ...labelState,
        labelsById: {
          ...labelState.labelsById,
          ...tagUpdates,
        },
      }
    })

    API.putLabels(Object.values(tagUpdates))
  }

  function onExpand(expandedKeys) {
    setExpandedKeys(expandedKeys)
    setAutoExpandParent(false)
  }

  async function updateLabel(label: Label) {
    setLabelState((labelsState) => {
      return {
        ...labelsState,
        labelsById: { ...labelsState.labelsById, [label.id]: label },
      }
    })
    const _updatedLabel = await API.putLabel(label)
  }

  function LabelView(label: Label, allowEdit: boolean) {
    return () => {
      if (allowEdit) {
        return (
          <Menu isLazy={true} placement="bottom">
            {({ onClose, isOpen }) => (
              <>
                <MenuButton>
                  <LabelTagColor colorHex={label.color_hex} />
                </MenuButton>
                {isOpen && (
                  <MenuList minW="0" w={'10em'}>
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
          <LabelTagColor
            colorHex={label.color_hex}
            onClick={() => props.onSelect && props.onSelect(label)}
          />
        )
      }
    }
  }

  /**
   * Updates the label in the state and sends a DELETE request to the API to delete the label.
   */
  function onDeleteLabel(label: Label) {
    setLabelState((prevState) => {
      return produce(prevState, (draft) => {
        delete draft.labelsById[label.id]
      })
    })

    API.deleteLabel(label.id).then((r) => {
      toast({
        render: (props) => (
          <InfoAlert title={`Tag ${label.title} deleted.`} onClose={props.onClose} />
        ),
      })
    })
  }

  function onClickEditLabel(item: TreeItem) {
    const labelColor = LABEL_COLORS.find((color) => color.hex == item.label.color_hex)

    setLabelState((labelsState) => {
      return {
        ...labelsState,
        editingLabel: {
          active: true,
          labelId: item.key,
          labelTitle: item.title,
          labelColor: labelColor,
        },
      }
    })
  }

  function LabelTitle(item: TreeItem, allowEdit: boolean, curMenuExpanded: boolean) {
    if (allowEdit) {
      return (
        <Hoverable>
          {(isMouseInside, onMouseEnter, onMouseLeave) => (
            <Flex
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              justifyContent="space-between"
              alignItems="center"
              paddingBottom="2px"
            >
              <Text fontSize="sm" color="gray.700">
                {item.title}
              </Text>

              <Menu isLazy gutter={-1}>
                {({ isOpen }) => (
                  <>
                    <MenuButton
                      variant="unstyled"
                      color="gray.600"
                      size="sm"
                      as={Button}
                      fontWeight="normal"
                      visibility={isMouseInside || curMenuExpanded || isOpen ? 'visible' : 'hidden'}
                    >
                      <FiMoreHorizontal size={'1.25em'} />
                    </MenuButton>

                    {curMenuExpanded ||
                      (isOpen && (
                        <Portal>
                          <MenuList>
                            <MenuItem
                              fontSize="sm"
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
                              fontSize="sm"
                              onClick={() => {
                                setConfirmDeleteLabel(item.label)
                                onMouseLeave()
                              }}
                              icon={<FiTrash />}
                              iconSpacing="1"
                            >
                              Delete
                            </MenuItem>
                          </MenuList>
                        </Portal>
                      ))}
                  </>
                )}
              </Menu>
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

  function treeData(data: TreeItem[], allowEdit: boolean): DataNode[] {
    const Switcher = (props: TreeNodeProps) => {
      if (props.expanded) {
        return <FiChevronDown size={'1.25em'} style={{ marginTop: 1 }} />
      } else {
        return <FiChevronRight size={'1.25em'} style={{ marginTop: 1 }} />
      }
    }

    return data.map((item) => {
      const curMenuExpanded = selectedLabelId == item.key

      if (item.children && item.children.length) {
        return {
          switcherIcon: Switcher,
          key: item.key,
          icon: LabelView(item.label, allowEdit),
          title: LabelTitle(item, allowEdit, curMenuExpanded),
          children: treeData(item.children, allowEdit),
        }
      }

      return {
        key: item.key,
        icon: LabelView(item.label, allowEdit),
        title: LabelTitle(item, allowEdit, curMenuExpanded),
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
    <>
      <ConfirmDeleteLabelDialog
        label={confirmDeleteLabel}
        onClose={() => setConfirmDeleteLabel(undefined)}
        onDelete={(label) => {
          onDeleteLabel(label)
          setConfirmDeleteLabel(undefined)
        }}
        cancelRef={confirmDeleteCancelRef}
      />

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
    </>
  )
}

function ConfirmDeleteLabelDialog(props: {
  label: Label | undefined
  onClose: () => void
  onDelete: (labelId: Label) => void
  cancelRef: React.RefObject<HTMLButtonElement>
}) {
  if (!props.label) {
    return <></>
  }

  return (
    <AlertDialog
      isOpen={!!props.label}
      leastDestructiveRef={props.cancelRef}
      onClose={props.onClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader fontSize="md">Delete tag {props.label.title}?</AlertDialogHeader>
          <AlertDialogBody fontSize={'sm'}>
            This will remove the tag <b>{props.label.title}</b> from all events.
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={props.cancelRef} onClick={props.onClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={() => props.onDelete(props.label!)} ml={3}>
              Delete Tag
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

export default LabelTree
