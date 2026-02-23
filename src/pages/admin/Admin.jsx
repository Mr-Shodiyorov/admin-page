// Admin.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./Admin.css";
import {
  useAddProductMutation,
  useDeleteProductMutation,
  useGetProductsQuery,
  useUpdateProductMutation,
} from "../../app/services/authApi";
import { supabase } from "../../app/supabaseClient";
import { useTranslation } from "react-i18next";

const EMPTY = {
  title: "",
  brand: "",
  gender: "unisex",
  valute: "USD",
  price: 0,
  discount: 0,
  item_left: 0,
  info: "",
  release_date: "",
  images: [],
  ml_sizes: [],
};

function calcDiscountedPrice(price, discount) {
  const p = Number(price || 0);
  const dRaw = Number(discount || 0);
  const d = Math.min(100, Math.max(0, dRaw));
  const discounted = p * (1 - d / 100);
  return Number(discounted.toFixed(2));
}

function normalizeMl(list) {
  const arr = Array.isArray(list) ? list : [];
  const clean = arr
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
  return Array.from(new Set(clean)).sort((a, b) => a - b);
}

export default function Admin() {
  const { t, i18n } = useTranslation();

  const [lang, setLang] = useState(() => {
    return localStorage.getItem("lang") || i18n.language || "en";
  });

  useEffect(() => {
    i18n.changeLanguage(lang);
    localStorage.setItem("lang", lang);
  }, [lang, i18n]);

  const {
    data: products = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useGetProductsQuery();

  const [addProduct, { isLoading: adding }] = useAddProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();
  const [deleteProduct, { isLoading: deleting }] = useDeleteProductMutation();

  const [q, setQ] = useState("");
  const [gender, setGender] = useState("all");

  const [selected, setSelected] = useState(null);
  const [openView, setOpenView] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [mode, setMode] = useState("add");
  const [draft, setDraft] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);

  const [unknownLeft, setUnknownLeft] = useState(false);

  const [openDelete, setOpenDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [mlInput, setMlInput] = useState("");

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

  const openViewModal = (p) => { setSelected(p); setOpenView(true); };
  const closeViewModal = () => { setOpenView(false); setSelected(null); };

  const openAddModal = () => {
    setMode("add"); setDraft(EMPTY); setSelected(null);
    setUnknownLeft(false); setMlInput(""); setOpenForm(true);
  };

  const openEditModal = (p) => {
    setMode("edit"); setSelected(p); setDraft(productToDraft(p));
    setUnknownLeft(p.item_left == null); setMlInput(""); setOpenForm(true);
  };

  const closeFormModal = () => {
    setOpenForm(false); setSelected(null); setDraft(EMPTY);
    setUnknownLeft(false); setMlInput("");
  };

  const onRowClick = (e, p) => { if (e.target.closest("button")) return; openViewModal(p); };

  const askDelete = (e, product) => { e?.stopPropagation?.(); setDeleteTarget(product); setOpenDelete(true); };
  const closeDeleteModal = () => { if (deleteBusy) return; setOpenDelete(false); setDeleteTarget(null); };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleteBusy(true);
    try {
      await deleteProduct(deleteTarget.id).unwrap();
      if (selected?.id === deleteTarget.id) closeViewModal();
      if (openForm && selected?.id === deleteTarget.id) closeFormModal();
      closeDeleteModal();
    } catch (err) {
      alert(getErr(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const addMlChip = (value) => {
    const n = Number(String(value).trim());
    if (!Number.isFinite(n) || n <= 0) return;
    setDraft((prev) => ({ ...prev, ml_sizes: normalizeMl([...(prev.ml_sizes || []), n]) }));
    setMlInput("");
  };

  const onMlKeyDown = (e) => { if (e.key === "Enter") { e.preventDefault(); addMlChip(mlInput); } };

  const removeMlChip = (ml) => {
    setDraft((prev) => ({
      ...prev,
      ml_sizes: normalizeMl((prev.ml_sizes || []).filter((x) => Number(x) !== Number(ml))),
    }));
  };

  const onPickImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const slice = files.slice(0, 3);
    setUploading(true);
    try {
      const urls = [];
      for (const file of slice) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `products/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
        const { error: upErr, data } = await supabase.storage
          .from("product-images")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("product-images").getPublicUrl(data.path);
        urls.push(pub.publicUrl);
      }
      setDraft((prev) => ({ ...prev, images: [...(prev.images || []), ...urls].slice(0, 3) }));
    } catch (err) {
      alert(err?.message || t("misc.uploadError"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = (idx) => {
    setDraft((prev) => ({ ...prev, images: (prev.images || []).filter((_, i) => i !== idx) }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.brand.trim()) { alert(t("misc.validationTitleBrand")); return; }
    const originalPrice = Number(draft.price || 0);
    const finalPrice = calcDiscountedPrice(originalPrice, draft.discount);
    const body = {
      title: draft.title.trim(), brand: draft.brand.trim(),
      gender: draft.gender, valute: draft.valute ?? "USD",
      old_money: originalPrice, price: finalPrice,
      discount: Number(draft.discount || 0),
      item_left: unknownLeft ? null : Number(draft.item_left || 0),
      info: draft.info?.trim() || null,
      release_date: draft.release_date?.trim() || null,
      images: Array.isArray(draft.images) ? draft.images : [],
      ml_sizes: normalizeMl(draft.ml_sizes),
    };
    try {
      if (mode === "add") await addProduct(body).unwrap();
      else await updateProduct({ id: selected.id, patch: body }).unwrap();
      closeFormModal();
    } catch (err) {
      alert(getErr(err));
    }
  };

  if (isLoading) return <AdminSkeleton />;

  if (isError)
    return (
      <div className="admin-wrap">
        <div className="admin-header">
          <div>
            <h2>{t("admin.title")}</h2>
            <p className="muted">{t("admin.error")}</p>
          </div>
          <div className="header-actions">
            <button className="btn" onClick={refetch}>{t("admin.retry")}</button>
          </div>
        </div>
        <p className="error">{error?.status} {error?.data?.message || t("admin.error")}</p>
      </div>
    );

  return (
    <div className="admin-wrap">
      {/* ── HEADER ── */}
      <div className="admin-header">
        <div>
          <h2>{t("admin.title")}</h2>
          <p className="muted">
            {t("admin.total", { total: products.length, showing: filtered.length })}
          </p>
        </div>

        <div className="header-actions">
          <div className="lang-wrap" role="group" aria-label="Change language">
            {["en", "uz", "ru"].map((l) => (
              <button
                key={l}
                className={"lang-btn" + (lang === l ? " active" : "")}
                onClick={() => setLang(l)}
                type="button"
                aria-pressed={lang === l}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="btn" onClick={refetch}>{t("admin.refresh")}</button>
          <button className="btn primary" onClick={openAddModal}>{t("admin.add")}</button>
        </div>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="admin-toolbar">
        <input
          type="text"
          placeholder={t("admin.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="all">{t("admin.gender.all")}</option>
          <option value="men">{t("admin.gender.men")}</option>
          <option value="women">{t("admin.gender.women")}</option>
          <option value="unisex">{t("admin.gender.unisex")}</option>
          <option value="universal">{t("admin.gender.universal")}</option>
        </select>
      </div>

      {/* ── TABLE ── */}
      <div className="admin-card">
        {/* Desktop: scrollable table */}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("admin.table.product")}</th>
                <th>{t("admin.table.brand")}</th>
                <th className="col-gender">{t("admin.table.gender")}</th>
                <th>{t("admin.table.price")}</th>
                <th className="col-discount">{t("admin.table.discount")}</th>
                <th className="col-left">{t("admin.table.left")}</th>
                <th className="col-ml">{t("admin.table.ml")}</th>
                <th className="col-release">{t("admin.table.release")}</th>
                <th className="th-actions">{t("admin.table.actions")}</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="row" onClick={(e) => onRowClick(e, p)}>
                  {/* Product */}
                  <td className="product-cell-td">
                    <div className="product-cell">
                      <img
                        src={firstImage(p.images)}
                        alt={p.title || t("misc.unknownProduct")}
                        width={46} height={46}
                        loading="lazy" decoding="async"
                        onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/46")}
                      />
                      <div>
                        <strong className="product-title" title={p.title}>{p.title}</strong>
                        <small>{p.id}</small>
                      </div>
                    </div>
                  </td>

                  {/* Brand */}
                  <td data-label={t("admin.table.brand")}>{p.brand}</td>

                  {/* Gender */}
                  <td className="col-gender" data-label={t("admin.table.gender")}>
                    <span className="badge">{p.gender}</span>
                  </td>

                  {/* Price */}
                  <td data-label={t("admin.table.price")}>
                    <span className="price-main">
                      {Number(p.price ?? 0).toFixed(2)} {p.valute ?? "USD"}
                    </span>
                    {Number(p.old_money ?? 0) > 0 && Number(p.old_money) !== Number(p.price) && (
                      <div className="price-old">
                        {t("admin.table.old", { price: Number(p.old_money).toFixed(2) })}
                      </div>
                    )}
                  </td>

                  {/* Discount */}
                  <td className="col-discount" data-label={t("admin.table.discount")}>{Number(p.discount ?? 0)}%</td>

                  {/* Stock */}
                  <td className="col-left" data-label={t("admin.table.left")}>
                    {p.item_left == null ? t("misc.dash") : p.item_left}
                  </td>

                  {/* ML */}
                  <td className="col-ml" data-label={t("admin.table.ml")}>
                    <span className="ml-inline">
                      {Array.isArray(p.ml_sizes) && p.ml_sizes.length > 0 ? (
                        p.ml_sizes.slice(0, 3).map((m) => (
                          <span key={m} className="ml-pill">{m}ml</span>
                        ))
                      ) : (
                        <span className="muted">{t("misc.dash")}</span>
                      )}
                      {Array.isArray(p.ml_sizes) && p.ml_sizes.length > 3 && (
                        <span className="ml-more">+{p.ml_sizes.length - 3}</span>
                      )}
                    </span>
                  </td>

                  {/* Release */}
                  <td className="col-release" data-label={t("admin.table.release")}>{p.release_date || "—"}</td>

                  {/* Actions */}
                  <td className="actions">
                    <button
                      className="btn ghost"
                      onClick={(e) => { e.stopPropagation(); openEditModal(p); }}
                    >
                      {t("admin.actions.edit")}
                    </button>
                    <button
                      className="btn danger"
                      onClick={(e) => askDelete(e, p)}
                      disabled={deleting}
                    >
                      {t("admin.actions.delete")}
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "32px 16px" }} className="muted">
                    {t("admin.table.noProducts")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── VIEW MODAL ── */}
      {openView && selected && (
        <div className="modal-overlay" onClick={closeViewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div>
                <h3 className="modal-h">{selected.title}</h3>
                <p className="muted">
                  {selected.brand} • <span className="badge">{selected.gender}</span>
                </p>
              </div>
              <button className="icon-btn" onClick={closeViewModal}>✕</button>
            </div>

            <div className="modal-body">
              <div className="modal-grid">
                <Gallery images={selected.images} title={selected.title} t={t} />

                <div className="details">
                  <div className="kvs">
                    <div className="kv">
                      <span>{t("viewModal.priceDiscounted")}</span>
                      <b>{Number(selected.price ?? 0).toFixed(2)} {selected.valute ?? "USD"}</b>
                    </div>
                    <div className="kv">
                      <span>{t("viewModal.oldMoney")}</span>
                      <b>{Number(selected.old_money ?? 0).toFixed(2)}</b>
                    </div>
                    <div className="kv">
                      <span>{t("viewModal.discount")}</span>
                      <b>{Number(selected.discount ?? 0)}%</b>
                    </div>
                    <div className="kv">
                      <span>{t("viewModal.itemLeft")}</span>
                      <b>{selected.item_left == null ? t("misc.dash") : selected.item_left}</b>
                    </div>
                    <div className="kv">
                      <span>{t("viewModal.mlSizes")}</span>
                      <b className="ml-inline">
                        {Array.isArray(selected.ml_sizes) && selected.ml_sizes.length > 0
                          ? selected.ml_sizes.map((m) => <span key={m} className="ml-pill">{m}ml</span>)
                          : t("misc.dash")}
                      </b>
                    </div>
                    <div className="kv">
                      <span>{t("viewModal.releaseDate")}</span>
                      <b>{selected.release_date || "—"}</b>
                    </div>
                  </div>

                  <div className="section">
                    <h4>{t("viewModal.info")}</h4>
                    <p className="text">{selected.info || t("viewModal.noInfo")}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn ghost"
                onClick={() => { closeViewModal(); openEditModal(selected); }}
              >
                {t("viewModal.edit")}
              </button>
              <button className="btn danger" onClick={(e) => askDelete(e, selected)} disabled={deleting}>
                {t("viewModal.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD/EDIT MODAL ── */}
      {openForm && (
        <div className="modal-overlay" onClick={closeFormModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div>
                <h3 className="modal-h">
                  {mode === "add" ? t("formModal.addTitle") : t("formModal.editTitle")}
                </h3>
                <p className="muted">{t("formModal.subtitle")}</p>
              </div>
              <button className="icon-btn" onClick={closeFormModal}>✕</button>
            </div>

            <form className="modal-body" onSubmit={onSubmit}>
              <div className="form-grid">
                <div className="form-row">
                  <label htmlFor="product-title">{t("formModal.title")}</label>
                  <input
                    id="product-title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <label htmlFor="product-brand">{t("formModal.brand")}</label>
                  <input
                    id="product-brand"
                    value={draft.brand}
                    onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <label htmlFor="product-gender">{t("formModal.gender")}</label>
                  <select
                    id="product-gender"
                    value={draft.gender}
                    onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                  >
                    <option value="men">{t("admin.gender.men")}</option>
                    <option value="women">{t("admin.gender.women")}</option>
                    <option value="unisex">{t("admin.gender.unisex")}</option>
                  </select>
                </div>

                <div className="form-row">
                  <label htmlFor="product-valute">{t("formModal.valute")}</label>
                  <select
                    id="product-valute"
                    value={draft.valute ?? "USD"}
                    onChange={(e) => setDraft({ ...draft, valute: e.target.value })}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="UZS">UZS (sum)</option>
                  </select>
                </div>

                {/* ML chip input */}
                <div className="form-row">
                  <label>{t("formModal.mlSizes")}</label>
                  <div className="ml-add">
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder={t("formModal.mlPlaceholder")}
                      value={mlInput}
                      onChange={(e) => setMlInput(e.target.value)}
                      onKeyDown={onMlKeyDown}
                    />
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => addMlChip(mlInput)}
                      disabled={!String(mlInput).trim()}
                    >
                      {t("formModal.addMl")}
                    </button>
                  </div>
                  <div className="ml-chips">
                    {Array.isArray(draft.ml_sizes) && draft.ml_sizes.length > 0 ? (
                      draft.ml_sizes.map((m) => (
                        <span key={m} className="ml-chip">
                          <span className="ml-chip-txt">{m} ml</span>
                          <button type="button" className="ml-x" onClick={() => removeMlChip(m)}>✕</button>
                        </span>
                      ))
                    ) : (
                      <span className="muted">{t("formModal.noMlYet")}</span>
                    )}
                  </div>
                </div>

                <div className="form-2col">
                  <div className="form-row">
                    <label htmlFor="product-price">{t("formModal.priceOriginal")}</label>
                    <input
                      id="product-price"
                      type="number" step="0.01"
                      value={draft.price}
                      onFocus={(e) => { if (Number(e.target.value) === 0) e.target.select(); }}
                      onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                    />
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {t("formModal.finalSavedPrice")}{" "}
                      {calcDiscountedPrice(draft.price, draft.discount).toFixed(2)}
                    </div>
                  </div>

                  <div className="form-row">
                    <label htmlFor="product-discount">{t("formModal.discountPercent")}</label>
                    <input
                      id="product-discount"
                      type="number"
                      value={draft.discount}
                      onFocus={(e) => { if (Number(e.target.value) === 0) e.target.select(); }}
                      onChange={(e) => setDraft({ ...draft, discount: Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-row">
                    <label htmlFor="product-left">{t("formModal.itemLeft")}</label>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        id="product-left"
                        type="number"
                        value={draft.item_left}
                        disabled={unknownLeft}
                        onFocus={(e) => { if (Number(e.target.value) === 0) e.target.select(); }}
                        onChange={(e) => setDraft({ ...draft, item_left: Number(e.target.value) })}
                      />
                      <label style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none", fontSize: 13, opacity: .9, whiteSpace: "nowrap" }}>
                        <input type="checkbox" checked={unknownLeft} onChange={(e) => setUnknownLeft(e.target.checked)} />
                        {t("formModal.unknown")}
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <label htmlFor="product-release">{t("formModal.releaseDate")}</label>
                  <input
                    id="product-release"
                    value={draft.release_date}
                    onChange={(e) => setDraft({ ...draft, release_date: e.target.value })}
                    placeholder={t("formModal.releasePlaceholder")}
                  />
                </div>

                <div className="form-row">
                  <label htmlFor="product-info">{t("formModal.info")}</label>
                  <textarea
                    id="product-info"
                    rows={4}
                    value={draft.info}
                    onChange={(e) => setDraft({ ...draft, info: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <label htmlFor="product-images">{t("formModal.images")}</label>
                  <input
                    id="product-images"
                    type="file" multiple accept="image/*"
                    onChange={onPickImages}
                  />
                  <div className="upload-hint">
                    {uploading ? t("formModal.uploading") : t("formModal.uploadHint")}
                  </div>
                  <div className="thumbs">
                    {(draft.images || []).map((src, idx) => (
                      <div key={src + idx} className="thumbWrap">
                        <img src={src} alt={`Product preview ${idx + 1}`} width={190} height={190} loading="lazy" decoding="async" />
                        <button type="button" className="miniX" onClick={() => removeImage(idx)} aria-label={t("formModal.removeImage", { n: idx + 1 })}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={closeFormModal}>{t("formModal.cancel")}</button>
                <button type="submit" className="btn primary" disabled={uploading || adding || updating}>
                  {mode === "add"
                    ? adding ? t("formModal.adding") : t("formModal.addBtn")
                    : updating ? t("formModal.saving") : t("formModal.saveBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {openDelete && deleteTarget && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top delete-top">
              <div className="delete-head">
                <div className="danger-dot" aria-hidden="true">!</div>
                <div>
                  <h3 className="modal-h">{t("deleteModal.title")}</h3>
                  <p className="muted delete-sub">{t("deleteModal.subtitle")}</p>
                </div>
              </div>
              <button className="icon-btn" onClick={closeDeleteModal}>✕</button>
            </div>

            <div className="modal-body">
              <div className="delete-card">
                <img
                  className="delete-img"
                  src={firstImage(deleteTarget.images)}
                  alt={deleteTarget.title || t("misc.unknownProduct")}
                  width={58} height={58}
                  onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/58")}
                />
                <div className="delete-meta">
                  <div className="delete-title">{deleteTarget.title || t("misc.untitled")}</div>
                  <div className="delete-small">
                    {deleteTarget.brand || "—"} • <span className="badge">{deleteTarget.gender || "unisex"}</span>
                  </div>
                </div>
              </div>

              <div className="delete-warn">
                <div className="delete-warn-icn" aria-hidden="true">⚠</div>
                <div><b>{t("deleteModal.headsUp")}</b> {t("deleteModal.warnText")}</div>
              </div>
            </div>

            <div className="modal-actions delete-actions">
              <button className="btn ghost" type="button" onClick={closeDeleteModal} disabled={deleteBusy}>
                {t("deleteModal.cancel")}
              </button>
              <button className="btn danger solid" type="button" onClick={confirmDelete} disabled={deleteBusy}>
                {deleteBusy ? t("deleteModal.deleting") : t("deleteModal.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function firstImage(images) {
  if (Array.isArray(images) && images.length > 0) return images[0];
  return "https://via.placeholder.com/46";
}

function productToDraft(p) {
  const original = Number(p.old_money ?? p.price ?? 0);
  return {
    title: p.title ?? "",
    brand: p.brand ?? "",
    gender: p.gender ?? "unisex",
    valute: p.valute ?? "USD",
    price: Number.isFinite(original) ? original : 0,
    discount: Number(p.discount ?? 0),
    item_left: Number(p.item_left ?? 0),
    info: p.info ?? "",
    release_date: p.release_date ?? "",
    images: Array.isArray(p.images) ? p.images : [],
    ml_sizes: Array.isArray(p.ml_sizes) ? normalizeMl(p.ml_sizes) : [],
  };
}

function Gallery({ images, title, t }) {
  const safe = Array.isArray(images) ? images.filter(Boolean) : [];
  const [idx, setIdx] = useState(0);
  const current = safe[idx] || "https://via.placeholder.com/520x360";
  const prev = () => safe.length && setIdx((p) => (p - 1 + safe.length) % safe.length);
  const next = () => safe.length && setIdx((p) => (p + 1) % safe.length);

  return (
    <div className="gallery">
      <div className="gallery-main">
        <img
          src={current} alt={title}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
          loading="lazy" decoding="async"
          onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/520x360")}
        />
        {safe.length > 1 && (
          <>
            <button className="nav-btn left" onClick={prev} aria-label="Previous image">‹</button>
            <button className="nav-btn right" onClick={next} aria-label="Next image">›</button>
          </>
        )}
      </div>
      <div className="thumbs">
        {safe.length === 0 ? (
          <span className="muted">{t("misc.noImages")}</span>
        ) : (
          safe.map((src, i) => (
            <button
              key={src + i} type="button"
              className={`thumb ${i === idx ? "active" : ""}`}
              onClick={() => setIdx(i)}
              aria-label={`Show image ${i + 1}`}
            >
              <img src={src} alt={`${title}-${i}`} width={68} height={56} loading="lazy" decoding="async" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div className="admin-wrap skeleton-page">
      {/* Header */}
      <div className="admin-header sk-header">
        <div className="sk-header-left">
          <div className="sk-block sk-title" />
          <div className="sk-block sk-subtitle" />
        </div>
        <div className="sk-header-right">
          <div className="sk-block sk-pill" />
          <div className="sk-block sk-btn" />
          <div className="sk-block sk-btn sk-btn-primary" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="sk-toolbar">
        <div className="sk-block sk-search" />
        <div className="sk-block sk-filter" />
      </div>

      {/* Table card */}
      <div className="sk-card">
        {/* Table head */}
        <div className="sk-thead">
          {['Product', 'Brand', 'Gender', 'Price', 'Discount', 'Stock', 'Actions'].map((_, i) => (
            <div key={i} className="sk-block sk-th" style={{ width: [140, 80, 70, 90, 70, 60, 80][i] }} />
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="sk-row"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* product cell */}
            <div className="sk-product-cell">
              <div className="sk-block sk-avatar" />
              <div className="sk-product-text">
                <div className="sk-block sk-name" />
                <div className="sk-block sk-id" />
              </div>
            </div>
            <div className="sk-block sk-cell" style={{ width: 70 }} />
            <div className="sk-block sk-cell sk-badge" style={{ width: 60 }} />
            <div className="sk-block sk-cell" style={{ width: 88 }} />
            <div className="sk-block sk-cell" style={{ width: 42 }} />
            <div className="sk-block sk-cell" style={{ width: 36 }} />
            <div className="sk-actions-cell">
              <div className="sk-block sk-action-btn" />
              <div className="sk-block sk-action-btn sk-action-danger" />
            </div>
          </div>
        ))}
      </div>

      {/* Floating pulse orb */}
      <div className="sk-orb" aria-hidden="true" />
    </div>
  );
}

function getErr(err) {
  return err?.data?.message || err?.error || err?.message || "Something went wrong";
}