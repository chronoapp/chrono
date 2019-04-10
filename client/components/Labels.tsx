import * as React from 'react';

/**
 * List of labels.
 */
export default class Labels extends React.Component<{}, {}> {

    componentWillMount() {
        // TODO: API request for labels.
    }

    render() {
        return (
            <nav className="panel">
                <p className="panel-heading">
                    labels
                </p>
                <a className="panel-block is-active">
                    <span className="panel-icon">
                    <i className="fas fa-book" aria-hidden="true"></i>
                    </span>
                    eating
                </a>
                <a className="panel-block">
                    <span className="panel-icon">
                    <i className="fas fa-book" aria-hidden="true"></i>
                    </span>
                    working
                </a>
          </nav>
        );
    }
}