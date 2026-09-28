import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    const fn = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  const items = [
    "Dashboard",
    "Map",
    "Assets",
    "Dependency Graph",
    "Maintenance",
    "Assistant",
  ];
  const routes = {
    Dashboard: "/",
    Map: "/map",
    Assets: "/assets",
    "Dependency Graph": "/graph",
    Maintenance: "/maintenance",
    Assistant: "/assistant",
  };
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={() => setOpen(false)}>
      <div className="command-palette" onMouseDown={(e) => e.stopPropagation()}>
        <Search size={17} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to a workspace view..."
        />
        {items
          .filter((x) => x.toLowerCase().includes(query.toLowerCase()))
          .map((item) => (
            <button
              key={item}
              onClick={() => {
                navigate(routes[item]);
                setOpen(false);
              }}
            >
              {item}
              <kbd>↵</kbd>
            </button>
          ))}
      </div>
    </div>
  );
}
