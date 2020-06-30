import React, { useState } from 'react';
import styled from 'styled-components';
import { resetServerContext } from 'react-beautiful-dnd-next';
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
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';

import { createTreeFromLabels } from '../util/Tree';
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
    resetServerContext();
    const [tree, setTree] = useState(createTreeFromLabels(props.labels))

    function getIcon(
        item: TreeItem,
        onExpand: (itemId: ItemId) => void,
        onCollapse: (itemId: ItemId) => void) {

        if (item.children && item.children.length > 0) {
            return item.isExpanded ? (
                    <KeyboardArrowDownIcon
                        style={{marginBottom: '5px'}}
                        onClick={() => onCollapse(item.id)}
                    />
                ) : (
                    <ChevronRightIcon
                        style={{marginBottom: '5px'}}
                        onClick={() => onExpand(item.id)}
                    />
                );
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
