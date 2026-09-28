import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api, dataOf } from "../../lib/api";
import { Badge, Empty, ErrorState, Loading } from "../../components/States";

export default function DocumentsTab({ assetId }) {
  const query = useQuery({
    queryKey: ["documents", assetId],
    queryFn: () => dataOf(api.get("/documents", { params: { assetId } })),
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("assetId", assetId);
      body.append("file", file);
      await api.post("/documents", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFile(null);
      await query.refetch();
      toast.success("Document uploaded");
    } catch (error) {
      toast.error(error.response?.data?.error || "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    try {
      await api.delete(`/documents/${id}`);
      await query.refetch();
      toast.success("Document deleted");
    } catch (error) {
      toast.error(error.response?.data?.error || "Delete failed");
    }
  }
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <section className="panel">
      <div className="panel-heading">
        <span>
          <small>Asset record</small>
          <h2>Documents</h2>
        </span>
      </div>
      <div className="document-upload">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(event) => setFile(event.target.files[0])}
        />
        <button
          className="primary-button"
          disabled={!file || busy}
          onClick={upload}
        >
          {busy ? "Uploading..." : "Upload document"}
        </button>
      </div>
      {query.data.length ? (
        <div className="document-list">
          {query.data.map((document) => (
            <div className="document-row" key={document._id}>
              <span>
                <a href={document.url} target="_blank" rel="noreferrer">
                  <b>{document.name}</b>
                </a>
                <small>
                  {new Date(document.createdAt).toLocaleDateString()} ·{" "}
                  {document.resourceType || "file"}
                </small>
              </span>
              <button
                className="danger-button"
                onClick={() => remove(document._id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty label="No documents uploaded for this asset." />
      )}
    </section>
  );
}
