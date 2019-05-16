import * as React from 'react';
import { Label } from '../models/Label';


interface IProps {
    labels: Label[]
}

/**
 * List of labels.
 */
export default function Labels(props: IProps) {

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
                <span className="panel-icon">
                    <i className="fas fa-book" aria-hidden="true"></i>
                </span>
                {label.title}
            </a>
        )
    }
}
