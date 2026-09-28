import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("infralife_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("infralife_token");
      localStorage.removeItem("infralife_user");
      if (window.location.pathname !== "/login")
        window.location.assign(
          `/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        );
    }
    return Promise.reject(error);
  },
);
export const dataOf = (request) =>
  request.then((response) => response.data.data);
export async function uploadFile(file) {
  const body = new FormData();
  body.append("file", file);
  return dataOf(
    api.post("/uploads", body, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  );
}
