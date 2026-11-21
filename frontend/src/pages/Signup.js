import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../utils/api";
import { toast } from "react-toastify";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await API.post("/auth/signup", {
        ...form,
        email: form.email.trim().toLowerCase(),
      });
      toast.success(response.data.msg);
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.msg || "Signup failed");
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/signup"><span aria-hidden="true">♡</span> battle<span>meet</span></Link>
        <h1>Make room for a connection</h1>
        <p className="auth-intro">Create an account to meet people who feel like your kind of person.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="signup-name">Your name</label>
          <input
            id="signup-name"
            type="text"
            name="name"
            placeholder="How should we call you?"
            value={form.name}
            onChange={handleChange}
            required
            className="auth-input"
          />
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            name="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            required
            className="auth-input"
          />
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            className="auth-input"
          />
          <button type="submit" className="button button-primary auth-submit">Create account</button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
