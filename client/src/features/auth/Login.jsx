import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const demoAccounts = [
  { role: "ADMIN", email: "admin@infralife.gov", password: "Passw0rd!" },
  { role: "MANAGER", email: "manager@infralife.gov", password: "Passw0rd!" },
  {
    role: "INSPECTOR",
    email: "inspector@infralife.gov",
    password: "Passw0rd!",
  },
  {
    role: "MAINTENANCE",
    email: "maintenance@infralife.gov",
    password: "Passw0rd!",
  },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [role, setRole] = useState("ADMIN");
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    try {
      await login(demoAccounts.find((account) => account.role === role));
      navigate(
        params.get("returnTo") || location.state?.from?.pathname || "/",
        { replace: true },
      );
    } catch {
      setError("Invalid credentials. Try the seeded admin account.");
    }
  }
  return (
    <main className="login-page">
      <div className="login-brand-panel">
        <div className="login-grid" />
        <div className="brand large">
          <span>IL</span>
          <b>InfraLife</b>
        </div>
        <div className="login-brand-copy">
          <p className="eyebrow">Government infrastructure operations</p>
          <h1>
            From asset register
            <br />
            to lifecycle twin.
          </h1>
          <p>
            Trusted infrastructure intelligence for the teams keeping the
            corridor moving.
          </p>
        </div>
      </div>
      <div className="login-card">
        <div className="brand large">
          <span>IL</span>
          <b>InfraLife</b>
        </div>
        <p className="eyebrow">Secure workspace</p>
        <h1>Welcome back.</h1>
        <p className="lede">
          Choose a demo role to enter the operations console.
        </p>
        <form onSubmit={submit}>
          <label>
            Demo account
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {demoAccounts.map((account) => (
                <option key={account.role} value={account.role}>
                  {account.role}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button">
            Enter workspace <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </main>
  );
}
