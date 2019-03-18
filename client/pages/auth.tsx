import React from 'react';
import { authenticate } from '../util/Api';
import Cookies from 'universal-cookie';


class Auth extends React.Component<{ query, resp },{}> {

    static async getInitialProps({ query }) {
        return { query }
    }

    public async componentDidMount() {
        const { code, state } = this.props.query;

        const cookies = new Cookies();
        const resp = await authenticate(code, state);
        cookies.set('auth_token', resp.token);

        window.location.replace('/');
    }

    public render() {
        // TODO: Handle errors.
        return (
            <div>Authenticating..</div>
        )
    }
}

export default Auth;
