import * as React from 'react';
import { Label } from '../models/Label';


interface IProps {
    labels: Label[]
}

/**
 * List of labels.
 */
export default function LabelPanel(props: IProps) {

    return (
        <nav className="panel">
            <p className="panel-heading">
                labels
            </p>
            {props.labels.map(getLabel)}
        </nav>
    );

    function getLabel(label: Label) {
        return (
            <a className={`panel-block ${false ? 'is-active' : ''}`}>
                <div style={{backgroundColor: `#${label.color_hex}`}} className="event_label"></div>
                <span style={{marginLeft: 10}}>{label.title}</span>
            </a>
        )
    }
}
