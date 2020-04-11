import React, { useState } from 'react';
import styled from 'styled-components';

import Tree, {
    mutateTree,
    moveItemOnTree,
    RenderItemParams,
    TreeItem,
    TreeData,
    ItemId,
    TreeSourcePosition,
    TreeDestinationPosition,
  } from '@atlaskit/tree';
import { resetServerContext } from 'react-beautiful-dnd-next';

import { Label } from '../models/Label';

const NavigationItemWrapper = styled.div`
    padding: 5px;
    background-color: ${props => props.isDragging ? 'lightgrey' : 'transparent'};
    display: flex;
`;

const EmptyIcon = styled.span`
  display: flex;
  width: 24px;
  height: 32px;
  justify-content: center;
  font-size: 12px;
  line-height: 32px;
`;

const NavigationItem = styled.div`
    background-color: ${props => props.isDragging ? 'lightgrey' : 'white'};
    display: flex;
`;

const TagColor = styled.div`
    width: 20px;
    height: 20px;
    background-color: ${props => props.color};
    border-radius: 4px;
    margin-right: 8px;
`;

interface IProps {
    labels: Label[]
}

export default function LabelTree(props: IProps) {
    const [tree, setTree] = useState(getLabelTree(props.labels))

    function _createItem(id: string, data: any) {
        return {
          id: `${id}`,
          children: [],
          hasChildren: false,
          isExpanded: false,
          isChildrenLoading: false,
          data: data
        };
    }

    function getLabelTree(labels: Label[]) {
        resetServerContext();

        const rootItem = _createItem('1', null)
        const tree: TreeData = {
            rootId: rootItem.id,
            items: { [rootItem.id]: rootItem },
        }

        labels.forEach((label, idx) => {
            const leafItem = _createItem(`${rootItem.id}-${idx}`, label);

            const root = tree.items[rootItem.id];
            root.children.push(leafItem.id);
            root.isExpanded = true;
            root.hasChildren = true;

            tree.items[leafItem.id] = leafItem
        });

        return tree;
    }

    function getIcon(
        item: TreeItem,
        onExpand: (itemId: ItemId) => void,
        onCollapse: (itemId: ItemId) => void) {

        if (item.children && item.children.length > 0) {
            return ">"
        }

        return <EmptyIcon/>;
    }

    function onExpand(itemId: ItemId) {
        setTree(mutateTree(tree, itemId, { isExpanded: true }));
      }
    
    function onCollapse(itemId: ItemId) {
        setTree(mutateTree(tree, itemId, { isExpanded: false }));
      }
    
    function onDragEnd(
        source: TreeSourcePosition,
        destination?: TreeDestinationPosition,
      ) {
        if (!destination) {
          return;
        }
    
        const newTree = moveItemOnTree(tree, source, destination);
        setTree(newTree);
    }    

    function renderItem({
        item,
        onExpand,
        onCollapse,
        provided,
        snapshot,
      }: RenderItemParams) {
        return (
            <div ref={provided.innerRef} {...provided.draggableProps}>
            <NavigationItemWrapper
                isDragging={snapshot.isDragging}
            >
                {getIcon(item, onExpand, onCollapse)}
                <TagColor
                    color={item.data.color_hex}
                    {...provided.dragHandleProps}
                />
                {item.data ? item.data.title : ''}
            </NavigationItemWrapper>
            </div>
        );
    }

    return (
        <div style={{height: '80vh', overflow: 'auto'}}>
            <Tree
                tree={tree}
                renderItem={renderItem}
                onExpand={onExpand}
                onCollapse={onCollapse}
                onDragEnd={onDragEnd}
                isDragEnabled={true}
                isNestingEnabled={true}
                offsetPerLevel={10}
            />
        </div>
    )
}
