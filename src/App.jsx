// src/App.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";

/** ===================== CONFIG: EDIT THESE ===================== **/
const BANK_DETAILS = {
  bank_name: "Opay Microfinance Bank",
  account_name: "Arafat Galadima Bala",
  account_number: "9134744193",
  note: "Use your Order ID as narration/description when transferring.",
};
/** ============================================================= **/

/* ================= UTIL ================= */
function money(n) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

function safeParseJSON(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

async function copyText(text, setToast) {
  try {
    await navigator.clipboard.writeText(String(text));
    setToast("Copied ✅");
    setTimeout(() => setToast(""), 900);
  } catch {
    setToast("Copy failed ❌");
    setTimeout(() => setToast(""), 900);
  }
}

// merges/sets ?text= in an existing wa.me URL safely
function buildWhatsAppUrl(baseUrl, extraText) {
  if (!baseUrl) return "";
  try {
    const u = new URL(baseUrl);
    const existing = u.searchParams.get("text") || "";
    const decoded = existing ? decodeURIComponent(existing) : "";
    const merged = decoded ? `${decoded}\n\n${extraText}` : extraText;
    u.searchParams.set("text", merged);
    return u.toString();
  } catch {
    // if URL parsing fails, fallback (best-effort)
    const joiner = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${joiner}text=${encodeURIComponent(extraText)}`;
  }
}

function makeProofMessage({ orderId, totalAmount, proofLink }) {
  const lines = [
    "Hello, I have made the bank transfer ✅",
    `Order ID: ${orderId ?? "—"}`,
  ];
  if (totalAmount != null) lines.push(`Total: ${money(totalAmount)}`);
  lines.push("Proof of payment:");
  lines.push(proofLink ? proofLink : "(Attached in WhatsApp)");
  lines.push("Please confirm my order. Thank you.");
  return lines.join("\n");
}

/* ================= FILTER & SORT PANEL ================= */
function FilterPanel({
  open,
  onClose,
  sortBy,
  setSortBy,
  inStockOnly,
  setInStockOnly,
}) {
  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.panelHeader}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Filter & Sort</div>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.panelBody}>
          <div style={styles.panelRow}>
            <div style={styles.panelLabel}>Sort by</div>
            <select
              style={styles.select}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
              <option value="name_asc">Name: A → Z</option>
            </select>
          </div>

          <label style={styles.toggleRow}>
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            <span>In-stock only</span>
          </label>

          <button style={styles.secondaryBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= QUICK VIEW ================= */
function QuickView({ product, onClose, onAddToCart }) {
  const [qty, setQty] = useState(1);

  useEffect(() => setQty(1), [product?.id]);

  if (!product) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.quickView} onClick={(e) => e.stopPropagation()}>
        <div style={styles.quickHeader}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Quick View</div>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.quickBody}>
          <div style={styles.quickImageWrap}>
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                style={styles.quickImage}
              />
            ) : (
              <div style={styles.imagePlaceholder}>
                <div style={{ fontWeight: 950, fontSize: 22 }}>
                  {(product.name || "P").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>No image</div>
              </div>
            )}
          </div>

          <div style={styles.quickInfo}>
            <div style={styles.category}>{product.category?.name}</div>
            <div style={styles.qTitle}>{product.name}</div>

            <div style={styles.qPriceRow}>
              <div style={styles.qPrice}>{money(product.price)}</div>
              <div style={styles.qStock}>
                Stock: <b>{product.stock}</b>
              </div>
            </div>

            {product.description ? (
              <div style={styles.qDesc}>{product.description}</div>
            ) : (
              <div style={styles.qDescMuted}>
                No description yet. (Add from Django admin.)
              </div>
            )}

            <div style={styles.qDivider} />

            <div style={styles.qtyRow}>
              <button
                style={styles.qtyBtn}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <input
                style={styles.qtyInput}
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              />
              <button style={styles.qtyBtn} onClick={() => setQty((q) => q + 1)}>
                +
              </button>
            </div>

            <button
              style={styles.primaryBtn}
              onClick={() => {
                onAddToCart(product.id, qty);
                onClose();
              }}
            >
              Add to Cart
            </button>

            <div style={{ color: "#64748b", fontSize: 13 }}>
              Checkout creates an order, then pay by bank transfer.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= PRODUCT CARD ================= */
function ProductCard({ p, onOpen, onAddToCart }) {
  const [hover, setHover] = useState(false);
  const inStock = (p.stock || 0) > 0;

  return (
    <div
      style={{ ...styles.card, ...(hover ? styles.cardHover : null) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={styles.imageWrap} onClick={onOpen} role="button" tabIndex={0}>
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} style={styles.image} />
        ) : (
          <div style={styles.imagePlaceholder}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>
              {(p.name || "P").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>No image</div>
          </div>
        )}
      </div>

      <div style={styles.cardBody} onClick={onOpen} role="button" tabIndex={0}>
        <div style={styles.category}>{p.category?.name}</div>
        <div style={styles.title}>{p.name}</div>
        <div style={styles.price}>{money(p.price)}</div>
        <div style={styles.stock}>Stock: {p.stock}</div>
      </div>

      <div style={styles.cardButtons}>
        <button style={styles.secondaryBtnFull} onClick={onOpen}>
          Quick View
        </button>
        <button
          style={{
            ...styles.primaryBtnSquare,
            ...(inStock ? null : styles.disabledBtn),
          }}
          disabled={!inStock}
          onClick={() => onAddToCart(p.id, 1)}
        >
          {inStock ? "Add to Cart" : "Out of stock"}
        </button>
      </div>
    </div>
  );
}

/* ================= CART DRAWER ================= */
function CartDrawer({
  open,
  onClose,
  items,
  productsById,
  setQty,
  removeItem,
  clearCart,
  onCheckout,
}) {
  if (!open) return null;

  const lines = items
    .map(({ product_id, quantity }) => {
      const p = productsById.get(product_id);
      if (!p) return null;
      const price = Number(p.price || 0);
      return { p, quantity, subtotal: price * quantity };
    })
    .filter(Boolean);

  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.cart} onClick={(e) => e.stopPropagation()}>
        <div style={styles.cartHeader}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Your Cart</div>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {lines.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Cart is empty</div>
            <div style={{ color: "#64748b", marginTop: 6 }}>
              Add products, then checkout.
            </div>
          </div>
        ) : (
          <>
            <div style={styles.cartList}>
              {lines.map(({ p, quantity, subtotal }) => (
                <div key={p.id} style={styles.cartRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, color: "#0f172a" }}>
                      {p.name}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {money(p.price)} each • Stock {p.stock}
                    </div>
                  </div>

                  <div style={styles.cartQty}>
                    <button
                      style={styles.qtyBtnSm}
                      onClick={() => setQty(p.id, Math.max(1, quantity - 1))}
                    >
                      −
                    </button>
                    <input
                      style={styles.qtyInputSm}
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQty(p.id, Math.max(1, Number(e.target.value) || 1))}
                    />
                    <button
                      style={styles.qtyBtnSm}
                      onClick={() => setQty(p.id, quantity + 1)}
                    >
                      +
                    </button>
                  </div>

                  <div style={styles.cartRight}>
                    <div style={{ fontWeight: 950 }}>{money(subtotal)}</div>
                    <button
                      style={styles.linkBtn}
                      onClick={() => removeItem(p.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.cartTotal}>
              <div style={{ color: "#64748b" }}>Total</div>
              <div style={{ fontWeight: 950, fontSize: 20 }}>{money(total)}</div>
            </div>

            <CheckoutBox
              total={total}
              onCheckout={onCheckout}
              onClear={clearCart}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ================= CHECKOUT BOX ================= */
function CheckoutBox({ total, onCheckout, onClear }) {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!customerName.trim()) return setErr("Enter your name.");
    if (!phone.trim()) return setErr("Enter your phone number.");

    setLoading(true);
    try {
      await onCheckout({ customer_name: customerName, phone, address });
    } catch {
      setErr("Checkout failed. Make sure Django server is running.");
      setLoading(false);
    }
  };

  return (
    <div style={styles.cartForm}>
      <div style={{ fontWeight: 950 }}>Checkout</div>
      <div style={{ color: "#64748b", fontSize: 13 }}>
        After checkout, you’ll be redirected to your Order page.
      </div>

      <label style={styles.label}>
        Your Name
        <input
          style={styles.input}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
      </label>

      <label style={styles.label}>
        Phone
        <input
          style={styles.input}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>

      <label style={styles.label}>
        Address (optional)
        <input
          style={styles.input}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </label>

      {err ? <div style={styles.error}>{err}</div> : null}

      <div style={styles.cartActions}>
        <button style={styles.secondaryBtn} onClick={onClear} disabled={loading}>
          Clear Cart
        </button>
        <button style={styles.primaryBtn} onClick={submit} disabled={loading}>
          {loading ? "Creating order..." : `Create Order (${money(total)})`}
        </button>
      </div>
    </div>
  );
}

/* ================= HOME PAGE (ROUTE) ================= */
function HomePage(props) {
  const {
    products,
    loadingProducts,
    productsErr,
    categories,
    search,
    setSearch,
    category,
    setCategory,
    inStockOnly,
    setFilterOpen,
    cartCount,
    setCartOpen,
    filtered,
    featured,
    mainGrid,
    setQuick,
    addToCart,
    clearFilters,
  } = props;

  return (
    <div style={styles.page}>
      <header style={styles.topbar}>
        <div style={styles.logoWrap}>
          <img
            src="/logo.jpg"
            alt="Logo"
            style={styles.logo}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div>
            <div style={styles.brand}>Medivance</div>
            <div style={styles.sub}>
              Medical and Dental equipment • Order via WhatsApp • Pay via bank transfer
            </div>
          </div>
        </div>

        <div style={styles.controls}>
          <input
            style={styles.search}
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            style={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "ALL" ? "All Categories" : c}
              </option>
            ))}
          </select>

          <button style={styles.filterBtn} onClick={() => setFilterOpen(true)}>
            Filter & Sort
          </button>

          <Link to="/payment" style={styles.payBtn}>
            Payment
          </Link>

          <button style={styles.cartBtn} onClick={() => setCartOpen(true)}>
            🛒 Cart {cartCount ? `(${cartCount})` : ""}
          </button>
        </div>
      </header>

      <div style={styles.tabsRow}>
        {categories.map((c) => {
          const active = c === category;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{ ...styles.tab, ...(active ? styles.tabActive : null) }}
            >
              {c === "ALL" ? "All" : c}
            </button>
          );
        })}
      </div>

      <section style={styles.hero}>
        <div style={{ fontSize: 18, fontWeight: 950 }}>
          Add to cart → Checkout → Pay by bank transfer → Send proof on WhatsApp.
        </div>
        <div style={{ color: "#64748b", marginTop: 6 }}>
          After checkout you get an Order page you can open anytime.
        </div>
      </section>

      {loadingProducts && <div style={styles.notice}>Loading products…</div>}
      {productsErr ? <div style={styles.notice}>{productsErr}</div> : null}

      {!loadingProducts && !productsErr && products.length === 0 && (
        <div style={styles.empty}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>No products yet</div>
          <div style={{ color: "#64748b", marginTop: 6 }}>
            Add products in Django admin, then refresh.
          </div>
        </div>
      )}

      <div style={styles.metaRow}>
        <div style={{ color: "#64748b" }}>
          Showing <b>{filtered.length}</b> product(s)
          {category !== "ALL" ? (
            <>
              {" "}
              in <b>{category}</b>
            </>
          ) : null}
          {search.trim() ? (
            <>
              {" "}
              for “<b>{search.trim()}</b>”
            </>
          ) : null}
          {inStockOnly ? (
            <>
              {" "}
              • <b>In-stock</b>
            </>
          ) : null}
        </div>

        <button style={styles.secondaryBtn} onClick={clearFilters}>
          Clear filters
        </button>
      </div>

      {featured.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>Featured Products</h2>
          <div style={styles.featuredRow}>
            {featured.map((p) => (
              <div key={p.id} style={styles.featuredCard}>
                <ProductCard
                  p={p}
                  onOpen={() => setQuick(p)}
                  onAddToCart={addToCart}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {mainGrid.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>All Products</h2>
          <div style={styles.grid}>
            {mainGrid.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                onOpen={() => setQuick(p)}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        </>
      )}

      {products.length > 0 && filtered.length === 0 && (
        <div style={styles.empty}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>No products found</div>
          <div style={{ color: "#64748b", marginTop: 6 }}>
            Try clearing filters or searching something else.
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= PAYMENT PAGE (ROUTE) ================= */
function PaymentPage({ lastOrder }) {
  const { orderId } = useParams();
  const location = useLocation();

  const [proofFile, setProofFile] = useState(null);
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");

  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderErr, setOrderErr] = useState("");

  const currentOrderId = orderId || lastOrder?.order_id || null;

  // whatsapp base from backend (already wa.me/..)
  const whatsappBase =
    order?.whatsapp_url ||
    lastOrder?.whatsapp_url ||
    "https://wa.me/2340000000000";

  // Load order detail (optional)
  useEffect(() => {
    if (!currentOrderId) return;

    setLoadingOrder(true);
    setOrderErr("");
    axios
      .get(`${API_BASE}/api/orders/${currentOrderId}/`)
      .then((res) => setOrder(res.data))
      .catch(() =>
        setOrderErr(
          "Could not load order details. Payment still works with bank info."
        )
      )
      .finally(() => setLoadingOrder(false));
  }, [currentOrderId]);

  // File preview
  useEffect(() => {
    if (!proofFile) {
      setProofUrl("");
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setProofUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  // Upload proof
  const uploadProof = async () => {
    if (!currentOrderId) return alert("No order ID");
    if (!proofFile) return alert("Pick a file first");

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", proofFile);
      fd.append("note", "Bank transfer proof");

      const res = await axios.post(
        `${API_BASE}/api/orders/${currentOrderId}/payment-proof/`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setUploadedUrl(res.data?.file_url || "");
      alert("Uploaded successfully ✅");
    } catch (e) {
      alert("Upload failed ❌");
    } finally {
      setUploading(false);
    }
  };

  const whatsappMessage = makeProofMessage({
    orderId: currentOrderId,
    totalAmount: order?.total_amount ?? null,
    proofLink: uploadedUrl || "",
  });

  const whatsappLink = buildWhatsAppUrl(whatsappBase, whatsappMessage);

  return (
    <div style={styles.page}>
      <h1 style={{ fontWeight: 950 }}>Payment</h1>
      <p style={{ color: "#64748b" }}>
        Pay via bank transfer and send proof on WhatsApp
      </p>

      {location.state?.fromCheckout && (
        <div style={styles.notice}>Order created successfully ✅</div>
      )}

      {loadingOrder ? (
        <div style={styles.notice}>Loading order details…</div>
      ) : null}

      {orderErr ? <div style={styles.notice}>{orderErr}</div> : null}

      <div style={styles.payGrid}>
        <div style={styles.payCard}>
          <h3>Bank Transfer Details</h3>

          <p>
            <b>Bank:</b> {BANK_DETAILS.bank_name}
          </p>
          <p>
            <b>Account Name:</b> {BANK_DETAILS.account_name}
          </p>
          <p>
            <b>Account Number:</b> {BANK_DETAILS.account_number}
          </p>

          <div style={styles.payNote}>
            <b>Order ID:</b> {currentOrderId || "—"}
            <br />
            {BANK_DETAILS.note}
          </div>

          {order?.total_amount != null && (
            <div style={{ marginTop: 10, color: "#0f172a", fontWeight: 900 }}>
              Total: {money(order.total_amount)}
            </div>
          )}
        </div>

        <div style={styles.payCard}>
          <h3>Upload Proof</h3>

          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
          />

          {proofUrl ? (
            proofFile?.type === "application/pdf" ? (
              <div style={{ ...styles.pdfPreview, marginTop: 10 }}>
                PDF selected: <b>{proofFile.name}</b>
              </div>
            ) : (
              <img
                src={proofUrl}
                alt="preview"
                style={{ ...styles.proofImg, marginTop: 10 }}
              />
            )
          ) : null}

          <button
            style={styles.secondaryBtn}
            onClick={uploadProof}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload Proof"}
          </button>

          <button
            style={{ ...styles.primaryBtn, marginTop: 12 }}
            onClick={() => (window.location.href = whatsappLink)}
          >
            Open WhatsApp & Send Proof
          </button>

          <Link to="/" style={styles.secondaryBtn}>
            Back to Shop
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ================= ORDER STATUS PAGE ================= */
function OrderStatusPage({ lastOrder }) {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState("");

  const fetchOrder = async (id) => {
    setLoading(true);
    setErr("");
    try {
      const res = await axios.get(`${API_BASE}/api/orders/${id}/`);
      setOrder(res.data);
    } catch (e) {
      setOrder(null);
      setErr(
        "Could not load order details. This page still works using your saved WhatsApp link + bank details."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) fetchOrder(orderId);
  }, [orderId]);

  const wa =
    order?.whatsapp_url ||
    (lastOrder?.order_id == Number(orderId) ? lastOrder?.whatsapp_url : "") ||
    lastOrder?.whatsapp_url ||
    "";

  return (
    <div style={styles.page}>
      <div style={styles.orderTop}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 950 }}>Order Status</div>
          <div style={{ color: "#64748b" }}>
            Order ID: <b>{orderId}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={styles.secondaryBtn} onClick={() => navigate("/")}>
            Back to Shop
          </button>
          <Link to={`/payment/${orderId}`} style={styles.payBtn}>
            Payment Page
          </Link>
        </div>
      </div>

      <div style={styles.statusGrid}>
        <div style={styles.statusCard}>
          <div style={styles.statusTitle}>Steps</div>

          <div style={styles.step}>
            <div style={styles.stepDot} />
            <div>
              <div style={styles.stepMain}>1) Order created</div>
              <div style={styles.stepSub}>You already have an Order ID. Keep it.</div>
            </div>
          </div>

          <div style={styles.step}>
            <div style={styles.stepDot} />
            <div>
              <div style={styles.stepMain}>2) Pay by bank transfer</div>
              <div style={styles.stepSub}>Use Order ID as narration/description.</div>
            </div>
          </div>

          <div style={styles.step}>
            <div style={styles.stepDot} />
            <div>
              <div style={styles.stepMain}>3) Send proof on WhatsApp</div>
              <div style={styles.stepSub}>We confirm payment and arrange delivery.</div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {wa ? (
              <button
                style={styles.primaryBtn}
                onClick={() => (window.location.href = wa)}
              >
                Open WhatsApp (Send Proof)
              </button>
            ) : (
              <button style={{ ...styles.primaryBtn, opacity: 0.6 }} disabled>
                WhatsApp link not saved
              </button>
            )}

            <button
              style={styles.secondaryBtn}
              onClick={() => copyText(orderId, setToast)}
            >
              Copy Order ID
            </button>
          </div>

          {toast ? <div style={styles.toast}>{toast}</div> : null}
        </div>

        <div style={styles.statusCard}>
          <div style={styles.statusTitle}>Bank Details</div>

          <div style={styles.payRow}>
            <div style={styles.payLabel}>Bank</div>
            <div style={styles.payValue}>{BANK_DETAILS.bank_name}</div>
            <button
              style={styles.copyBtn}
              onClick={() => copyText(BANK_DETAILS.bank_name, setToast)}
            >
              Copy
            </button>
          </div>

          <div style={styles.payRow}>
            <div style={styles.payLabel}>Account name</div>
            <div style={styles.payValue}>{BANK_DETAILS.account_name}</div>
            <button
              style={styles.copyBtn}
              onClick={() => copyText(BANK_DETAILS.account_name, setToast)}
            >
              Copy
            </button>
          </div>

          <div style={styles.payRow}>
            <div style={styles.payLabel}>Account number</div>
            <div style={{ ...styles.payValue, fontWeight: 950 }}>
              {BANK_DETAILS.account_number}
            </div>
            <button
              style={styles.copyBtn}
              onClick={() => copyText(BANK_DETAILS.account_number, setToast)}
            >
              Copy
            </button>
          </div>

          <div style={styles.payNote}>
            <b>Order ID:</b> {orderId} <br />
            <span style={{ color: "#64748b" }}>{BANK_DETAILS.note}</span>
          </div>

          {loading ? (
            <div style={{ color: "#64748b", marginTop: 10 }}>Loading order…</div>
          ) : null}

          {err ? (
            <div style={{ ...styles.notice, marginTop: 10, borderColor: "#e5e7eb" }}>
              {err}
            </div>
          ) : null}

          {order ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Order details</div>
              <div style={styles.orderBox}>
                <div>
                  <b>Customer:</b> {order.customer_name || "—"}
                </div>
                <div>
                  <b>Phone:</b> {order.phone || "—"}
                </div>
                <div>
                  <b>Address:</b> {order.address || "—"}
                </div>
                {order.total_amount != null ? (
                  <div>
                    <b>Total:</b> {money(order.total_amount)}
                  </div>
                ) : null}
                {order.status ? (
                  <div>
                    <b>Status:</b> {order.status}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ================= APP SHELL ================= */
function AppShell() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsErr, setProductsErr] = useState("");

  const [quick, setQuick] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");

  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [inStockOnly, setInStockOnly] = useState(false);

  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState(() => {
    const raw = localStorage.getItem("medstore_cart");
    const parsed = safeParseJSON(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  });

  const [lastOrder, setLastOrder] = useState(() => {
    const raw = localStorage.getItem("medstore_last_order");
    const parsed = safeParseJSON(raw, null);
    return parsed && typeof parsed === "object" ? parsed : null;
  });

  // Fix overflow
  useEffect(() => {
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";
    document.body.style.margin = "0";
    const root = document.getElementById("root");
    if (root) root.style.width = "100%";
  }, []);

  useEffect(() => {
    localStorage.setItem("medstore_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("medstore_last_order", JSON.stringify(lastOrder));
  }, [lastOrder]);

  // ✅ PRODUCTS FETCH + IMAGE URL NORMALIZATION
  useEffect(() => {
    setLoadingProducts(true);
    setProductsErr("");

    axios
      .get(`${API_BASE}/api/products/`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data?.results || [];

        const normalized = data.map((p) => {
          let img = p.image_url || "";
          // "/media/..."
          if (img && typeof img === "string" && img.startsWith("/")) img = `${API_BASE}${img}`;
          // "media/..." or "products/..."
          if (img && typeof img === "string" && !img.startsWith("http") && !img.startsWith("/")) {
            img = `${API_BASE}/${img}`;
          }
          return { ...p, image_url: img };
        });

        setProducts(normalized);

        if (normalized.length === 0) {
          setProductsErr("No products returned. Add products in Django admin and refresh.");
        }
      })
      .catch((e) => {
        console.error("Products fetch failed:", e);
        setProducts([]);
        setProductsErr("Products fetch failed. Is Django running on 127.0.0.1:8000?");
      })
      .finally(() => setLoadingProducts(false));
  }, []);

  const productsById = useMemo(() => {
    const m = new Map();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set();
    for (const p of products) if (p?.category?.name) set.add(p.category.name);
    return ["ALL", ...Array.from(set).sort()];
  }, [products]);

  const addToCart = (productId, qty = 1) => {
    const q = Math.max(1, Number(qty) || 1);
    setCart((prev) => {
      const copy = [...prev];
      const idx = copy.findIndex((x) => x.product_id === productId);
      if (idx >= 0) copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + q };
      else copy.push({ product_id: productId, quantity: q });
      return copy;
    });
    setCartOpen(true);
  };

  const setCartQty = (productId, qty) => {
    const q = Math.max(1, Number(qty) || 1);
    setCart((prev) =>
      prev.map((x) => (x.product_id === productId ? { ...x, quantity: q } : x))
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((x) => x.product_id !== productId));
  };

  const clearCart = () => setCart([]);

  const cartCount = useMemo(
    () => cart.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0),
    [cart]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = products.filter((p) => {
      const matchesCategory = category === "ALL" ? true : p?.category?.name === category;

      const matchesSearch = !q
        ? true
        : (p.name || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q) ||
          (p?.category?.name || "").toLowerCase().includes(q);

      const matchesStock = inStockOnly ? (p.stock || 0) > 0 : true;

      return matchesCategory && matchesSearch && matchesStock;
    });

    list = [...list].sort((a, b) => {
      const aPrice = Number(a.price || 0);
      const bPrice = Number(b.price || 0);

      if (sortBy === "price_asc") return aPrice - bPrice;
      if (sortBy === "price_desc") return bPrice - aPrice;
      if (sortBy === "name_asc")
        return String(a.name || "").localeCompare(String(b.name || ""));

      const aTime = a.created_at ? new Date(a.created_at).getTime() : a.id || 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : b.id || 0;
      return bTime - aTime;
    });

    return list;
  }, [products, search, category, inStockOnly, sortBy]);

  const featured = useMemo(() => {
    const count = Math.min(3, Math.max(0, filtered.length - 1));
    return filtered.slice(0, count);
  }, [filtered]);

  const featuredIds = useMemo(() => new Set(featured.map((p) => p.id)), [featured]);

  const mainGrid = useMemo(
    () => filtered.filter((p) => !featuredIds.has(p.id)),
    [filtered, featuredIds]
  );

  const clearFilters = () => {
    setSearch("");
    setCategory("ALL");
    setInStockOnly(false);
    setSortBy("newest");
  };

  // ✅ Checkout: create ONE order with many items, then go to /order/:id
  const checkoutCart = async ({ customer_name, phone, address }) => {
    const items = cart.map((x) => ({
      product_id: x.product_id,
      quantity: x.quantity,
    }));

    const res = await axios.post(`${API_BASE}/api/orders/`, {
      customer_name,
      phone,
      address,
      items,
    });

    const order = {
      order_id: res.data?.order_id,
      whatsapp_url: res.data?.whatsapp_url,
      created_at: new Date().toISOString(),
    };

    if (!order.order_id) throw new Error("No order_id returned.");
    if (!order.whatsapp_url) throw new Error("No whatsapp_url returned.");

    setLastOrder(order);
    clearCart();
    setCartOpen(false);

    navigate(`/order/${order.order_id}`, { state: { fromCheckout: true } });
  };

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              products={products}
              loadingProducts={loadingProducts}
              productsErr={productsErr}
              categories={categories}
              search={search}
              setSearch={setSearch}
              category={category}
              setCategory={setCategory}
              inStockOnly={inStockOnly}
              setFilterOpen={setFilterOpen}
              cartCount={cartCount}
              setCartOpen={setCartOpen}
              filtered={filtered}
              featured={featured}
              mainGrid={mainGrid}
              setQuick={setQuick}
              addToCart={addToCart}
              clearFilters={clearFilters}
            />
          }
        />
        <Route path="/payment" element={<PaymentPage lastOrder={lastOrder} />} />
        <Route path="/payment/:orderId" element={<PaymentPage lastOrder={lastOrder} />} />
        <Route path="/order/:orderId" element={<OrderStatusPage lastOrder={lastOrder} />} />
      </Routes>

      <QuickView
        product={quick}
        onClose={() => setQuick(null)}
        onAddToCart={addToCart}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        productsById={productsById}
        setQty={setCartQty}
        removeItem={removeFromCart}
        clearCart={clearCart}
        onCheckout={checkoutCart}
      />

      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        sortBy={sortBy}
        setSortBy={setSortBy}
        inStockOnly={inStockOnly}
        setInStockOnly={setInStockOnly}
      />
    </>
  );
}

/* ================= EXPORT APP ================= */
export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

/* ================= STYLES ================= */
const styles = {
  page: {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    padding: 20,
    maxWidth: 1200,
    margin: "0 auto",
    background: "#ffffff",
    overflowX: "hidden",
  },

  topbar: {
    display: "flex",
    gap: 16,
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  logoWrap: { display: "flex", gap: 15, alignItems: "center" },
  logo: { width: 70, height: 70, objectFit: "contain", color: "#5a84d6"  },
  brand: { fontSize: 28, fontWeight: 950, letterSpacing: -0.3 },
  sub: { color: "#64748b", marginTop: 6 },

  controls: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  search: {
    padding: 10,
    border: "1px solid ",
    borderRadius: 10,
    fontSize: 14,
    minWidth: 280,
    outline: "none",
  },

  select: {
    padding: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 14,
    outline: "none",
    background: "white",
  },

  filterBtn: {
    padding: "10px 12px",
    border: "1px solid #0f172a",
    background: "white",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 800,
  },

  payBtn: {
    padding: "10px 12px",
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "white",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
  },

  cartBtn: {
    padding: "10px 12px",
    border: "1px solid #0ea5e9",
    background: "#0ea5e9",
    color: "white",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 900,
  },

  tabsRow: {
    display: "flex",
    gap: 16,
    alignItems: "center",
    overflowX: "auto",
    padding: "10px 0 14px",
    borderBottom: "1px solid #eef2f7",
    marginBottom: 12,
    WebkitOverflowScrolling: "touch",
  },
  tab: {
    border: "1px solid transparent",
    background: "transparent",
    cursor: "pointer",
    padding: "10px 12px",
    fontWeight: 800,
    color: "#0f172a",
    whiteSpace: "nowrap",
    borderRadius: 999,
    outline: "none",
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    flex: "0 0 auto",
  },
  tabActive: { borderColor: "#0f172a", background: "#f8fafc" },

  hero: {
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },

  metaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },

  secondaryBtn: {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnFull: {
    padding: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 0,
    cursor: "pointer",
    fontWeight: 900,
    width: "100%",
  },

  sectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 26,
    fontWeight: 950,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 360px))",
    gap: 16,
    justifyContent: "center",
  },

  featuredRow: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  featuredCard: { width: 360, maxWidth: "100%" },

  card: {
    border: "1px solid #eef2f7",
    borderRadius: 16,
    overflow: "hidden",
    background: "white",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 10px 25px rgba(2, 6, 23, 0.05)",
    transform: "translateY(0px)",
    transition: "transform 160ms ease, box-shadow 160ms ease",
  },
  cardHover: {
    transform: "translateY(-3px)",
    boxShadow: "0 16px 35px rgba(2, 6, 23, 0.1)",
  },

  imageWrap: {
    height: 220,
    background: "#f8fafc",
    borderBottom: "1px solid #eef2f7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
    background: "#f8fafc",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#0f172a",
  },

  cardBody: { padding: 14, flex: 1, cursor: "pointer" },
  category: { fontSize: 12, color: "#64748b", marginBottom: 6 },
  title: { fontSize: 16, fontWeight: 900, marginBottom: 10, color: "#0f172a" },
  price: { fontSize: 18, fontWeight: 950, marginBottom: 6, color: "#0f172a" },
  stock: { fontSize: 13, color: "#64748b" },

  cardButtons: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 0,
    borderTop: "1px solid #eef2f7",
  },

  primaryBtn: {
    padding: 12,
    border: "none",
    background: "#0ea5e9",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    width: "100%",
    borderRadius: 10,
  },
  primaryBtnSquare: {
    padding: 12,
    border: "none",
    background: "#0ea5e9",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    width: "100%",
    borderRadius: 0,
  },
  disabledBtn: { opacity: 0.6, cursor: "not-allowed" },

  empty: {
    marginTop: 20,
    border: "1px solid #eef2f7",
    borderRadius: 16,
    padding: 18,
    background: "#f8fafc",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 50,
  },

  panel: {
    width: "min(520px, 100%)",
    background: "white",
    borderRadius: 16,
    padding: 16,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  panelBody: { display: "grid", gap: 12 },
  panelRow: { display: "grid", gap: 8 },
  panelLabel: { fontSize: 13, color: "#111827", fontWeight: 800 },
  toggleRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    fontWeight: 800,
    color: "#0f172a",
  },

  closeBtn: {
    border: "none",
    background: "#f3f4f6",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
  },

  label: {
    display: "grid",
    gap: 6,
    fontSize: 13,
    color: "#111827",
    fontWeight: 800,
  },
  input: {
    padding: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    fontSize: 14,
    outline: "none",
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 10,
    borderRadius: 12,
    fontSize: 13,
  },

  quickView: {
    width: "min(980px, 100%)",
    background: "white",
    borderRadius: 18,
    padding: 16,
  },
  quickHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  quickBody: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  quickImageWrap: {
    height: 420,
    border: "1px solid #eef2f7",
    borderRadius: 16,
    overflow: "hidden",
    background: "#f8fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  quickImage: { width: "100%", height: "100%", objectFit: "contain" },
  quickInfo: { display: "grid", gap: 10 },
  qTitle: { fontSize: 22, fontWeight: 950, color: "#0f172a" },
  qPriceRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  qPrice: { fontSize: 22, fontWeight: 950, color: "#0f172a" },
  qStock: { color: "#64748b" },
  qDesc: { color: "#0f172a", lineHeight: 1.55 },
  qDescMuted: { color: "#64748b", lineHeight: 1.55 },
  qDivider: { height: 1, background: "#eef2f7", margin: "6px 0" },
  qtyRow: { display: "flex", gap: 8, alignItems: "center" },
  qtyBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 18,
  },
  qtyInput: {
    width: 90,
    height: 42,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: "0 10px",
    fontSize: 14,
    outline: "none",
  },

  cart: {
    width: "min(860px, 100%)",
    background: "white",
    borderRadius: 18,
    padding: 16,
  },
  cartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  cartList: { display: "grid", gap: 12, marginBottom: 12 },
  cartRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 12,
    alignItems: "center",
    border: "1px solid #eef2f7",
    borderRadius: 14,
    padding: 12,
  },
  cartQty: { display: "flex", gap: 8, alignItems: "center" },
  cartRight: { display: "grid", justifyItems: "end", gap: 6 },
  cartTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    padding: "10px 2px",
    borderTop: "1px solid #eef2f7",
    marginTop: 6,
  },
  cartForm: { display: "grid", gap: 10, marginTop: 10 },
  cartActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  qtyBtnSm: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 16,
  },
  qtyInputSm: {
    width: 70,
    height: 34,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    padding: "0 10px",
    fontSize: 14,
    outline: "none",
  },
  linkBtn: {
    border: "none",
    background: "transparent",
    color: "#0ea5e9",
    cursor: "pointer",
    fontWeight: 900,
    padding: 0,
  },

  notice: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    fontWeight: 800,
    color: "#0f172a",
  },

  payGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  payCard: {
    border: "1px solid #eef2f7",
    borderRadius: 16,
    padding: 14,
    background: "#fff",
  },
  payRow: {
    display: "grid",
    gridTemplateColumns: "120px 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  payLabel: { color: "#64748b", fontWeight: 800, fontSize: 13 },
  payValue: { color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis" },
  copyBtn: {
    padding: "8px 10px",
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 900,
  },
  payNote: {
    marginTop: 10,
    background: "#f8fafc",
    border: "1px solid #eef2f7",
    borderRadius: 12,
    padding: 10,
    color: "#0f172a",
    lineHeight: 1.45,
  },
  toast: {
    marginTop: 10,
    padding: "8px 10px",
    borderRadius: 10,
    background: "#ecfeff",
    border: "1px solid #cffafe",
    color: "#0f172a",
    fontWeight: 900,
    width: "fit-content",
  },
  proofImg: {
    width: "100%",
    maxHeight: 320,
    objectFit: "contain",
    borderRadius: 12,
    border: "1px solid #eef2f7",
    background: "#f8fafc",
  },
  pdfPreview: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #eef2f7",
    background: "#f8fafc",
    color: "#0f172a",
    fontWeight: 800,
  },

  orderTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-end",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  statusCard: {
    border: "1px solid #eef2f7",
    borderRadius: 16,
    padding: 14,
    background: "#fff",
  },
  statusTitle: { fontWeight: 950, marginBottom: 10 },
  step: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: "10px 0",
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 6,
    background: "#0ea5e9",
    flex: "0 0 auto",
  },
  stepMain: { fontWeight: 900, color: "#0f172a" },
  stepSub: { color: "#64748b", fontSize: 13, marginTop: 3 },
  orderBox: {
    border: "1px solid #eef2f7",
    borderRadius: 12,
    padding: 10,
    background: "#f8fafc",
    color: "#0f172a",
    display: "grid",
    gap: 6,
  },
};
