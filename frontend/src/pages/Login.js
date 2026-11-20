import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../utils/api";
import { toast } from "react-toastify";

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await API.post("/auth/login", form);
      localStorage.setItem("token", res.data.token);
      toast.success("Login successful!");
      onLogin();
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.msg || "Login failed");
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/login"><span aria-hidden="true">♡</span> meet<span>cute</span></Link>
        <h1>Welcome back</h1>
        <p className="auth-intro">Sign in to find your next connection.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            name="email"
            placeholder="you@example.com"
            onChange={handleChange}
            required
            className="auth-input"
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            name="password"
            placeholder="Password"
            onChange={handleChange}
            required
            className="auth-input"
          />
          <button type="submit" className="button button-primary auth-submit">Sign in</button>
        </form>
        <p className="auth-footer">
          Don’t have an account? <Link to="/signup">Create one</Link>
        </p>
        <p className="auth-footer"><Link to="/reset">Forgot your password?</Link></p>
      </section>
    </main>
  );
}
