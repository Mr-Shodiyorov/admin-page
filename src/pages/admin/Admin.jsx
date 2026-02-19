import React, { useMemo, useState } from "react";
import "./Admin.css";
import {
  useAddProductMutation,
  useDeleteProductMutation,
  useGetProductsQuery,
  useUpdateProductMutation,
} from "../../app/services/authApi";
import { supabase } from "../../app/supabaseClient";

const EMPTY = {
  title: "",
  brand: "",
  gender: "unisex",
  price: 0,
  discount: 0,
  item_left: 0,
  info: "",
  release_date: "",
  images: [], // array of URLs
};

export default function Admin() {
  const { data: products = [], isLoading, isError, error, refetch } =
    useGetProductsQuery();

  const [addProduct, { isLoading: adding }] = useAddProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();
  const [deleteProduct, { isLoading: deleting }] = useDeleteProductMutation();

  const [q, setQ] = useState("");
  const [gender, setGender] = useState("all");

  // view modal
  const [selected, setSelected] = useState(null);
  const [openView, setOpenView] = useState(false);

  // form modal (add/edit)
  const [openForm, setOpenForm] = useState(false);
  const [mode, setMode] = useState("add"); // add | edit
  const [draft, setDraft] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !s ||
        (p.title || "").toLowerCase().includes(s) ||
        (p.brand || "").toLowerCase().includes(s);

      const matchGender = gender === "all" ? true : p.gender === gender;
      return matchSearch && matchGender;
    });
  }, [products, q, gender]);

  const openViewModal = (p) => {
    setSelected(p);
    setOpenView(true);
  };

  const closeViewModal = () => {
    setOpenView(false);
    setSelected(null);
  };

  const openAddModal = () => {
    setMode("add");
    setDraft(EMPTY);
    setSelected(null);
    setOpenForm(true);
  };

  const openEditModal = (p) => {
    setMode("edit");
    setSelected(p);
    setDraft(productToDraft(p));
    setOpenForm(true);
  };

  const closeFormModal = () => {
    setOpenForm(false);
    setSelected(null);
    setDraft(EMPTY);
  };

  const onRowClick = (e, p) => {
    if (e.target.closest("button")) return;
    openViewModal(p);
  };

  const onDelete = async (e, id) => {
    e.stopPropagation();
    const ok = confirm("Delete product?");
    if (!ok) return;
    try {
      await deleteProduct(id).unwrap();
      if (selected?.id === id) closeViewModal();
      closeFormModal();
    } catch (err) {
      alert(getErr(err));
    }
  };

  // ✅ Upload local files -> Storage -> get public URLs -> put into draft.images
  const onPickImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // limit 3
    const slice = files.slice(0, 3);

    setUploading(true);
    try {
      const urls = [];
      for (const file of slice) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `products/${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}.${ext}`;

        const { error: upErr, data } = await supabase.storage
          .from("product-images")
          .upload(path, file, { upsert: false });

        if (upErr) throw upErr;

        const { data: pub } = supabase.storage
          .from("product-images")
          .getPublicUrl(data.path);

        urls.push(pub.publicUrl);
      }

      setDraft((prev) => ({
        ...prev,
        images: [...(prev.images || []), ...urls].slice(0, 3),
      }));
    } catch (err) {
      alert(err?.message || "Upload error");
    } finally {
      setUploading(false);
      e.target.value = ""; // same file pick again works
    }
  };

  const removeImage = (idx) => {
    setDraft((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== idx),
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    // minimal validation
    if (!draft.title.trim() || !draft.brand.trim()) {
      alert("title va brand bo‘sh bo‘lmasin");
      return;
    }

    const body = {
      title: draft.title.trim(),
      brand: draft.brand.trim(),
      gender: draft.gender,
      price: Number(draft.price || 0),
      discount: Number(draft.discount || 0),
      item_left: Number(draft.item_left || 0),
      info: draft.info?.trim() || null,
      release_date: draft.release_date?.trim() || null,
      images: Array.isArray(draft.images) ? draft.images : [],
    };

    try {
      if (mode === "add") {
        await addProduct(body).unwrap();
      } else {
        await updateProduct({ id: selected.id, patch: body }).unwrap();
      }
      closeFormModal();
    } catch (err) {
      alert(getErr(err));
    }
  };

  if (isLoading) return <div className="admin-wrap">Loading...</div>;

  if (isError)
    return (
      <div className="admin-wrap">
        <div className="admin-header">
          <div>
            <h2>Admin • Products</h2>
            <p className="muted">Error</p>
          </div>
          <button className="btn" onClick={refetch}>
            Retry
          </button>
        </div>
        <p className="error">
          {error?.status} {error?.data?.message || "Error"}
        </p>
      </div>
    );

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <div>
          <h2>Admin • Products</h2>
          <p className="muted">
            Total: {products.length} • Showing: {filtered.length}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={refetch}>
            Refresh
          </button>
          <button className="btn primary" onClick={openAddModal}>
            + Add
          </button>
        </div>
      </div>

      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Search title / brand..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="all">All</option>
          <option value="men">men</option>
          <option value="women">women</option>
          <option value="unisex">unisex</option>
        </select>
      </div>

      <div className="admin-card">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Brand</th>
              <th>Gender</th>
              <th>Price</th>
              <th>Discount</th>
              <th>Left</th>
              <th>Release</th>
              <th className="th-actions">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="row" onClick={(e) => onRowClick(e, p)}>
                <td className="product-cell">
                  <img
                    src={firstImage(p.images)}
                    alt={p.title}
                    onError={(e) =>
                      (e.currentTarget.src = "https://via.placeholder.com/44")
                    }
                  />
                  <div>
                    <strong>{p.title}</strong>
                    <small>{p.id}</small>
                  </div>
                </td>
                <td>{p.brand}</td>
                <td>
                  <span className="badge">{p.gender}</span>
                </td>
                <td>${Number(p.price).toFixed(2)}</td>
                <td>{p.discount}%</td>
                <td>{p.item_left ?? 0}</td>
                <td>{p.release_date || "-"}</td>
                <td className="actions">
                  <button
                    className="btn ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(p);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn danger"
                    onClick={(e) => onDelete(e, p.id)}
                    disabled={deleting}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan="8" className="muted">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* VIEW MODAL */}
      {openView && selected && (
        <div className="modal-overlay" onMouseDown={closeViewModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div>
                <h3 className="modal-h">{selected.title}</h3>
                <p className="muted">
                  {selected.brand} •{" "}
                  <span className="badge">{selected.gender}</span>
                </p>
              </div>
              <button className="icon-btn" onClick={closeViewModal}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-grid">
                <Gallery images={selected.images} title={selected.title} />

                <div className="details">
                  <div className="kvs">
                    <div className="kv">
                      <span>Price</span>
                      <b>${Number(selected.price).toFixed(2)}</b>
                    </div>
                    <div className="kv">
                      <span>Discount</span>
                      <b>{selected.discount}%</b>
                    </div>
                    <div className="kv">
                      <span>Item left</span>
                      <b>{selected.item_left ?? 0}</b>
                    </div>
                    <div className="kv">
                      <span>Release date</span>
                      <b>{selected.release_date || "-"}</b>
                    </div>
                  </div>

                  <div className="section">
                    <h4>Info</h4>
                    <p className="text">{selected.info || "-"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn ghost"
                onClick={() => {
                  closeViewModal();
                  openEditModal(selected);
                }}
              >
                Edit
              </button>
              <button
                className="btn danger"
                onClick={(e) => onDelete(e, selected.id)}
                disabled={deleting}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {openForm && (
        <div className="modal-overlay" onMouseDown={closeFormModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div>
                <h3 className="modal-h">
                  {mode === "add" ? "Add product" : "Edit product"}
                </h3>
                <p className="muted">Upload 1–3 images from PC</p>
              </div>
              <button className="icon-btn" onClick={closeFormModal}>
                ✕
              </button>
            </div>

            <form className="modal-body" onSubmit={onSubmit}>
              <div className="form-grid">
                <div className="form-row">
                  <label>Title</label>
                  <input
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </div>

                <div className="form-row">
                  <label>Brand</label>
                  <input
                    value={draft.brand}
                    onChange={(e) =>
                      setDraft({ ...draft, brand: e.target.value })
                    }
                  />
                </div>

                <div className="form-row">
                  <label>Gender</label>
                  <select
                    value={draft.gender}
                    onChange={(e) =>
                      setDraft({ ...draft, gender: e.target.value })
                    }
                  >
                    <option value="men">men</option>
                    <option value="women">women</option>
                    <option value="unisex">unisex</option>
                  </select>
                </div>

                <div className="form-2col">
                  <div className="form-row">
                    <label>Price</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={draft.price}
                      onChange={(e) =>
                        setDraft({ ...draft, price: Number(e.target.value) })
                      }
                    />
                  </div>

                  <div className="form-row">
                    <label>Discount (%)</label>
                    <input
                      type="number"
                      defaultValue={draft.discount}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          discount: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="form-row">
                    <label>Item left</label>
                    <input
                      type="number"
                      defaultValue={draft.item_left}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          item_left: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-row">
                  <label>Release date</label>
                  <input
                    value={draft.release_date}
                    onChange={(e) =>
                      setDraft({ ...draft, release_date: e.target.value })
                    }
                    placeholder="YYYY-MM-DD"
                  />
                </div>

                <div className="form-row">
                  <label>Info</label>
                  <textarea
                    rows={4}
                    value={draft.info}
                    onChange={(e) =>
                      setDraft({ ...draft, info: e.target.value })
                    }
                  />
                </div>

                <div className="form-row">
                  <label>Images (1–3)</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={onPickImages}
                  />
                  <div className="upload-hint">
                    {uploading ? "Uploading..." : "Pick images from your PC"}
                  </div>

                  <div className="thumbs">
                    {(draft.images || []).map((src, idx) => (
                      <div key={src + idx} className="thumbWrap">
                        <img src={src} alt={`img-${idx}`} />
                        <button
                          type="button"
                          className="miniX"
                          onClick={() => removeImage(idx)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={closeFormModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={uploading || adding || updating}
                >
                  {mode === "add"
                    ? adding
                      ? "Adding..."
                      : "Add"
                    : updating
                    ? "Saving..."
                    : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function firstImage(images) {
  if (Array.isArray(images) && images.length > 0) return images[0];
  return "https://via.placeholder.com/44";
}

function productToDraft(p) {
  return {
    title: p.title ?? "",
    brand: p.brand ?? "",
    gender: p.gender ?? "unisex",
    price: Number(p.price ?? 0),
    discount: Number(p.discount ?? 0),
    item_left: Number(p.item_left ?? 0),
    info: p.info ?? "",
    release_date: p.release_date ?? "",
    images: Array.isArray(p.images) ? p.images : [],
  };
}

function Gallery({ images, title }) {
  const safe = Array.isArray(images) ? images.filter(Boolean) : [];
  const [idx, setIdx] = useState(0);
  const current = safe[idx] || "https://via.placeholder.com/520x360";

  const prev = () =>
    safe.length && setIdx((p) => (p - 1 + safe.length) % safe.length);
  const next = () => safe.length && setIdx((p) => (p + 1) % safe.length);

  return (
    <div className="gallery">
      <div className="gallery-main">
        <img
          src={current}
          alt={title}
          onError={(e) =>
            (e.currentTarget.src = "https://via.placeholder.com/520x360")
          }
        />

        {safe.length > 1 && (
          <>
            <button className="nav-btn left" onClick={prev} aria-label="Prev">
              ‹
            </button>
            <button className="nav-btn right" onClick={next} aria-label="Next">
              ›
            </button>
          </>
        )}
      </div>

      <div className="thumbs">
        {safe.length === 0 ? (
          <span className="muted">No images</span>
        ) : (
          safe.map((src, i) => (
            <button
              key={src + i}
              type="button"
              className={`thumb ${i === idx ? "active" : ""}`}
              onClick={() => setIdx(i)}
              title={`Image ${i + 1}`}
            >
              <img src={src} alt={`${title}-${i}`} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function getErr(err) {
  return err?.data?.message || err?.error || err?.message || "Something went wrong";
}
