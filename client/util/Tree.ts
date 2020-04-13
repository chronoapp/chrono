import { TreeData } from '@atlaskit/tree';
import { Label } from '../models/Label';


function createItem(id: number, data: any) {
    return {
      id: id,
      children: [],
      hasChildren: false,
      isExpanded: false,
      isChildrenLoading: false,
      data: data
    };
}

/**
 * Creates an @atlaskit/tree compatible structure from the list of
 * labels and their parent IDs.
 * @param Labels 
 */
export function createTreeFromLabels(labels: Label[]) {
    const rootItem = createItem(0, null)
    const tree: TreeData = {
        rootId: rootItem.id,
        items: { [rootItem.id]: rootItem },
    }

    labels.forEach(label => {
        const leafItem = createItem(label.id, label);
        tree.items[leafItem.id] = leafItem
    });

    // Update Parent Nodes
    labels.forEach(label => {
        if (label.parent_id) {
            const parent = tree.items[label.parent_id]
            parent.hasChildren = true
            parent.children.push(label.id)
        } else {
            const root = tree.items[0]
            root.hasChildren = true
            root.isExpanded = true
            root.children.push(label.id)
        }
    })

    return tree;
}
