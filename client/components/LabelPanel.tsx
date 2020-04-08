import React, { useState } from 'react';


import Icon from '@mdi/react'
import { mdiDotsHorizontal } from '@mdi/js'

import Hoverable from '../core/Hoverable';
import ColorPicker from './ColorPicker';
import { Label } from '../models/Label';


interface IProps {
    labels: Label[]
    updateLabel: (label: Label) => void;
}

/**
 * Panel with a list of labels.
 */
export default function LabelPanel(props: IProps) {
    const [selectedLabelKeyColor, setSelectedLabelKeyColor] = useState('')

    function toggleLabelKeyColor(labelKey: string) {
        if (labelKey == selectedLabelKeyColor) {
            setSelectedLabelKeyColor('');
        } else {
            setSelectedLabelKeyColor(labelKey);
        }
    }

    function onClickLabelColor(labelColor: string) {
        const selectedLabel = props.labels.find(
            label => label.key == selectedLabelKeyColor);
        if (selectedLabel) {
            selectedLabel.color_hex = labelColor;
            props.updateLabel(selectedLabel);
        }
        setSelectedLabelKeyColor('');
    }

    function getLabel(label: Label) {
        return (
            <Hoverable key={label.id}>
                {(isMouseInside, mouseEnter, mouseLeave) => (
                <a onMouseEnter={mouseEnter} onMouseLeave={mouseLeave} key={label.key}
                    className={`panel-block ${false ? 'is-active' : ''}`}>
                    <div className={`dropdown ${label.key === selectedLabelKeyColor ? 'is-active' : ''}`}>
                        <div
                            onClick={_ => toggleLabelKeyColor(label.key)}
                            style={{backgroundColor: label.color_hex}}
                            className="event-label event-label--hoverable dropdown-trigger"></div>
                        {label.key === selectedLabelKeyColor ?
                            <ColorPicker onSelectLabelColor={onClickLabelColor}/> : null}
                    </div>
                    <span style={{marginLeft: 10}}>{label.title}</span>
                    {isMouseInside ? <Icon path={mdiDotsHorizontal}
                        style={{marginLeft: 'auto'}}
                        size={1}
                        horizontal
                        vertical/>: null}
                </a>
                )}
            </Hoverable>
        )
    }

    return (
        <nav className="panel" style={{marginBottom: '0.5rem'}}>
            <p className="panel-heading">Projects</p>
            {props.labels.map(getLabel)}
        </nav>
    );
}
