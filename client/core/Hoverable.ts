import { Component } from 'react';

export default class Hoverable extends Component<{children: any}, {isMouseInside: boolean}> {
    constructor(props: {children: any}) {
        super(props);
        this.state = {
            isMouseInside: false
        };
    }

    mouseEnter = () => {
        this.setState({ isMouseInside: true });
    }

    mouseLeave = () => {
        this.setState({ isMouseInside: false });
    }

    render() {
        return this.props.children(
        this.state.isMouseInside, 
        this.mouseEnter, 
        this.mouseLeave
        )
    }
}
