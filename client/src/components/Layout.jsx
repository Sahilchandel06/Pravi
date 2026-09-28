import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  Bot,
  Boxes,
  ClipboardCheck,
  GitBranch,
  LogOut,
  Map,
  Wrench,
  Settings,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CommandPalette } from "./ui/CommandPalette";
import { Bell, Moon, Sun, Search } from "lucide-react";
import { useEffect, useState } from "react";

const links = [
  ["Dashboard", "/", Activity],
  ["Map", "/map", Map],
  ["Assets", "/assets", Boxes],
  ["Dependency Graph", "/graph", GitBranch],
  ["Maintenance", "/maintenance", Wrench, ["ADMIN", "MANAGER", "MAINTENANCE"]],
  ["Assistant", "/assistant", Bot],
  ["Inspections", "/inspections", ClipboardCheck, ["INSPECTOR"]],
];
export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(
    () => localStorage.getItem("infralife_theme") === "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("infralife_theme", dark ? "dark" : "light");
  }, [dark]);
  const visibleLinks = [
    ...links.filter(([, , , roles]) => !roles || roles.includes(user?.role)),
    ...(user?.role === "ADMIN"
      ? [["Asset Types", "/admin/asset-types", Settings]]
      : []),
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>IL</span>
          <b>InfraLife</b>
        </div>
        <div className="sector-label">
          ROADS / INDIA <i>LIVE</i>
        </div>
        <nav>
          {visibleLinks.map(([label, path, Icon]) => (
            <NavLink key={path} to={path} end={path === "/"} title={label}>
              <Icon size={17} strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-line">
            <span className="avatar">{user?.name?.[0]}</span>
            <span>
              <b>{user?.name}</b>
              <small>{user?.role}</small>
            </span>
          </div>
          <button
            className="ghost-button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-crumb">
            Roads <span>/</span> India operations
          </div>
          <button
            className="command-trigger"
            onClick={() =>
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
              )
            }
          >
            <Search size={15} />
            Search workspace <kbd>⌘ K</kbd>
          </button>
          <div className="topbar-actions">
            <button className="topbar-icon" aria-label="Notifications">
              <Bell size={17} />
              <i />
            </button>
            <button
              className="topbar-icon"
              aria-label="Toggle theme"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <span className="topbar-avatar">{user?.name?.[0]}</span>
          </div>
        </header>
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  );
}
