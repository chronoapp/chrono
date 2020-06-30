import { Component } from 'react';

interface IProps {
    children: any;
}

export default class Hoverable extends Component<IProps, { isMouseInside: boolean }> {
    constructor(props: IProps) {
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
