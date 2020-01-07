import * as React from 'react';
import { getSortedLabelColors } from '../models/LabelColors';

interface IProps {
    onSelectLabelColor: (string) => void;
}

export default class ColorPicker extends React.PureComponent<IProps, {}> {
    private labelColors = getSortedLabelColors()

    render() {
        const colors = this.labelColors.map(x => x.hex);

        return (
            <div className="dropdown-menu" id="dropdown-menu" role="menu" style={{maxWidth: '12em'}}>
                <div className="dropdown-content">
                    <div className="columns" style={{paddingLeft: '1.5em', marginBottom: 0}}>
                        {colors.slice(0, colors.length/2).map(color => {
                            return (
                                <div key={color} className="column is-1">
                                    <div style={{backgroundColor: color}}
                                        onClick={() => this.props.onSelectLabelColor(color)}
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
                                        onClick={() => this.props.onSelectLabelColor(color)}
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
