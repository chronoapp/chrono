import * as React from 'react';
import Icon from '@mdi/react'
import { mdiDotsHorizontal } from '@mdi/js'

import Hoverable from '../core/Hoverable';
import { Label } from '../models/Label';
import { getSortedLabelColors } from '../models/LabelColors';

interface IProps {
    labels: Label[]
    updateLabel: (label: Label) => void;
}

interface IState {
    selectedLabelKeyColor: string | null
}

/**
 * Panel with a list of labels.
 */
export default class LabelPanel extends React.Component<IProps, IState> {
    private labelColors = getSortedLabelColors()

    constructor(props: IProps) {
        super(props);
        this.state = {
            selectedLabelKeyColor: null
        }
        this.getLabel = this.getLabel.bind(this);
        this.onClickLabelColor = this.onClickLabelColor.bind(this);
    }

    render() {
        return (
            <nav className="panel">
                <p className="panel-heading">labels</p>
                {this.props.labels.map(this.getLabel)}
            </nav>
        );
    }

    private toggleLabelKeyColor(labelKey: string) {
        if (labelKey == this.state.selectedLabelKeyColor) {
            this.setState({selectedLabelKeyColor: null})
        } else {
            this.setState({selectedLabelKeyColor: labelKey})
        }
    }

    private onClickLabelColor(labelColor: string) {
        const selectedLabel = this.props.labels.find(
            label => label.key == this.state.selectedLabelKeyColor);
        if (selectedLabel) {
            selectedLabel.color_hex = labelColor;
            this.props.updateLabel(selectedLabel);
        }
        this.setState({selectedLabelKeyColor: null});
    }

    private getLabel(label: Label) {
        return (
            <Hoverable>
                {(isMouseInside, mouseEnter, mouseLeave) => (
                <a onMouseEnter={mouseEnter} onMouseLeave={mouseLeave} key={label.key}
                    className={`panel-block ${false ? 'is-active' : ''}`}>
                    <div className={`dropdown ${label.key === this.state.selectedLabelKeyColor ? 'is-active' : ''}`}>
                        <div
                            onClick={_ => this.toggleLabelKeyColor(label.key)}
                            style={{backgroundColor: label.color_hex}}
                            className="event-label event-label--hoverable dropdown-trigger"></div>
                        {label.key === this.state.selectedLabelKeyColor ? this.getColorPicker() : null}
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

    private getColorPicker() {
        const colors = this.labelColors.map(x => x.hex);

        return (
            <div className="dropdown-menu" id="dropdown-menu" role="menu" style={{maxWidth: '12em'}}>
                <div className="dropdown-content">
                    <div className="columns" style={{paddingLeft: '1.5em', marginBottom: 0}}>
                        {colors.slice(0, colors.length/2).map(color => {
                            return (
                                <div key={color} className="column is-1">
                                    <div style={{backgroundColor: color}}
                                        onClick={() => this.onClickLabelColor(color)}
                                        className="event-label event-label--hoverable"></div>
                                </div>
                            )
                        })}
                    </div>
                    <div className="columns" style={{paddingLeft: '1.5em'}}>
                        {colors.slice(6, colors.length).map(color => {
                            return (
                                <div key={color} className="column is-1">
                                    <div style={{backgroundColor: color}}
                                        onClick={() => this.onClickLabelColor(color)}
                                        className="event-label event-label--hoverable"></div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        )
    }
}
