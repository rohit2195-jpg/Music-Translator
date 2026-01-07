import { API_BASE } from './ApiBase';
import './Login.css';

function Login() {
    return (
        <div className="App">
            <header className="App-header">
                <a className="btn-spotify" href={`${API_BASE}/auth/login`} >
                    Login with Spotify 
                </a>
            </header>
        </div>
    );
}

export default Login;
