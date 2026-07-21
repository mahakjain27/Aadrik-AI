import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { FaEnvelope, FaLock, FaUser, FaEye, FaEyeSlash, FaArrowRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { login as loginAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.jpeg";
import logoBgMark from "../assets/logo-watermark-login.png";

export default function Login() {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            navigate("/dashboard", { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(true);
    const [showForgotNote, setShowForgotNote] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e) {
        e.preventDefault();

        setLoading(true);
        setError("");

        try {
            const data = await loginAPI(email, password, remember);

            login(data, remember);

        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Login failed."
            );
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-bg-blobs" aria-hidden="true">
                <span className="login-blob login-blob-1" />
                <span className="login-blob login-blob-2" />
                <span className="login-blob login-blob-3" />
            </div>

            <div className="login-bg-pattern" aria-hidden="true">
                <img src={logoBgMark} alt="" className="login-bg-logo" />
            </div>

            <div className="login-card">
                <img src={logo} alt="Aadrik AI" className="login-logo" />

                <form onSubmit={handleSubmit}>

                    <div className="login-field">
                        <label className="login-label">
                            <FaEnvelope className="login-label-icon" />
                            Email
                        </label>

                        <div className="login-input-group">
                            <FaUser className="login-input-icon" />
                            <input
                                className="login-input"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="username"
                            />
                        </div>
                    </div>

                    <div className="login-field">
                        <label className="login-label">
                            <FaLock className="login-label-icon" />
                            Password
                        </label>

                        <div className="login-input-group">
                            <FaLock className="login-input-icon" />
                            <input
                                type={showPassword ? "text" : "password"}
                                className="login-input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="login-eye-toggle"
                                tabIndex={-1}
                                onClick={() => setShowPassword((prev) => !prev)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    </div>

                    <div className="login-options-row">
                        <label className="login-remember">
                            <input
                                type="checkbox"
                                checked={remember}
                                onChange={(e) => setRemember(e.target.checked)}
                            />
                            Keep me signed in
                        </label>

                        <button
                            type="button"
                            className="login-forgot"
                            onClick={() => setShowForgotNote((prev) => !prev)}
                        >
                            Forgot password?
                        </button>
                    </div>

                    {showForgotNote && (
                        <div className="login-forgot-note">
                            Please contact your administrator to reset your password.
                        </div>
                    )}

                    {error && (
                        <div className="alert alert-danger login-alert">
                            {error}
                        </div>
                    )}

                    <button
                        className="login-submit-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Spinner animation="border" size="sm" />
                                Authenticating...
                            </>
                        ) : (
                            <>
                                Sign In
                                <FaArrowRight />
                            </>
                        )}
                    </button>

                </form>

                <div className="login-footer">
                    <span className="login-footer-dash" />
                    Powered by Aadrik Distributors Pvt. Ltd.
                    <span className="login-footer-dash" />
                </div>

                <div className="login-version">Version {__APP_VERSION__}</div>
            </div>
        </div>
    );
}
