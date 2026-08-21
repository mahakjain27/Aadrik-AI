import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from app.services.whatsapp_menu import find_product

router = APIRouter()

PAGE_TEMPLATE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Request a Quotation - Aadrik AI</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    background: #f3eefb;
    margin: 0;
    padding: 16px;
    color: #0b0b0b;
  }
  .card {
    max-width: 480px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(11,11,11,0.1);
    padding: 24px;
  }
  h1 {
    font-size: 20px;
    color: #5c1030;
    margin: 0 0 4px;
  }
  h2 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #52514e;
    margin: 20px 0 8px;
  }
  label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin: 14px 0 4px;
  }
  input, select, textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid rgba(11,11,11,0.15);
    border-radius: 8px;
    font-size: 15px;
    font-family: inherit;
  }
  textarea { resize: vertical; min-height: 60px; }
  button {
    width: 100%;
    margin-top: 20px;
    padding: 13px;
    background: #5c1030;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled { opacity: 0.6; }
  #error {
    color: #d03b3b;
    font-size: 13px;
    margin-top: 10px;
  }
  #success { text-align: center; padding: 20px 0; }
  #success h2 { color: #198754; text-align: center; }

  .cart-line {
    border: 1px solid rgba(11,11,11,0.1);
    border-radius: 10px;
    padding: 10px;
    margin-bottom: 8px;
  }
  .cart-line-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .cart-line-remove {
    color: #d03b3b;
    font-size: 12px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    width: auto;
    margin: 0;
  }
  .cart-line-fields {
    display: flex;
    gap: 8px;
  }
  .cart-line-fields > div { flex: 1; }
  .cart-line-fields label { margin: 0 0 4px; font-size: 11px; color: #666666; }
  .cart-line-fields input, .cart-line-fields select { padding: 8px; font-size: 14px; }
  .quantity-hint {
    font-size: 11px;
    color: #666666;
    margin-top: 3px;
  }

  #product-search-box { position: relative; }
  #product-results {
    position: absolute;
    z-index: 10;
    top: 100%;
    left: 0;
    right: 0;
    background: #ffffff;
    border: 1px solid rgba(11,11,11,0.15);
    border-radius: 8px;
    max-height: 220px;
    overflow-y: auto;
    box-shadow: 0 4px 16px rgba(11,11,11,0.12);
  }
  .product-result {
    padding: 10px 12px;
    font-size: 14px;
    cursor: pointer;
    border-bottom: 1px solid rgba(11,11,11,0.06);
  }
  .product-result:last-child { border-bottom: none; }
</style>
</head>
<body>
  <div class="card">
    <h1>Aadrik Distributors</h1>

    <div id="form">
      <h2>Your Quote</h2>
      <div id="cart"></div>

      <div id="product-search-box">
        <input id="product-search" placeholder="+ Search to add another product...">
        <div id="product-results" style="display:none"></div>
      </div>

      <h2>Your Details</h2>

      <label>Company Name *</label>
      <input id="company_name" required>

      <label>Contact Person *</label>
      <input id="contact_person" required>

      <label>Phone Number *</label>
      <input id="phone" value="__PHONE__" required>

      <label>Email</label>
      <input id="email" type="email">

      <label>Delivery City *</label>
      <input id="delivery_city" required>

      <label>Pincode</label>
      <input id="pincode">

      <label>GST Number</label>
      <input id="gst_number">

      <label>Notes</label>
      <textarea id="notes"></textarea>

      <button onclick="submitForm()">Submit Request</button>
      <div id="error"></div>
    </div>

    <div id="success" style="display:none">
      <h2>Request submitted!</h2>
      <p style="text-align:center">Our sales team will contact you shortly.</p>
    </div>
  </div>

<script>
// Quantity units differ by product line and aren't comparable to each other
// (kg vs. boxes vs. coils vs. packets) - mirrors QUANTITY_CATEGORIES in
// backend/app/services/lead_scoring.py and frontend/src/utils/productQuantity.js,
// kept in sync by hand since all three encode the same rules.
const QUANTITY_CATEGORIES = [
  { test: /\\bmig\\b|\\bmag\\b/i, unit: 'Coils' },
  { test: /\\btig\\b/i, unit: 'Kg' },
  { test: /6013/i, unit: 'Boxes' },
];
function quantityUnit(name) {
  const match = QUANTITY_CATEGORIES.find((c) => c.test.test(name || ''));
  return match ? match.unit : 'Packets';
}

let cart = [{
  id: __PRODUCT_ID_JSON__,
  name: __PRODUCT_NAME_JSON__,
  brand: __PRODUCT_BRAND_JSON__,
  sizes: __PRODUCT_SIZES_JSON__,
  size: (__PRODUCT_SIZES_JSON__ && __PRODUCT_SIZES_JSON__[0]) || null,
  quantity: '',
}];

// The WhatsApp number that opened this page via /quote?...&phone=... -
// kept separate from the editable "Phone Number" field below (which
// starts pre-filled with this same value, but the customer can change
// it). Never shown as its own field - just carried through silently so
// the CRM knows both numbers if they end up different.
const SOURCE_WHATSAPP_PHONE = __SOURCE_PHONE_JSON__ || null;

let ALL_PRODUCTS = [];

fetch('/public/products')
  .then((r) => r.json())
  .then((data) => { ALL_PRODUCTS = data.products || []; })
  .catch(() => {});

function renderCart() {
  const container = document.getElementById('cart');
  container.innerHTML = '';

  cart.forEach((line, i) => {
    const div = document.createElement('div');
    div.className = 'cart-line';

    const unit = quantityUnit(line.name);
    const removeBtn = cart.length > 1
      ? `<button type="button" class="cart-line-remove" onclick="removeCartLine(${i})">Remove</button>`
      : '';

    const sizeField = line.sizes && line.sizes.length
      ? `<div>
          <label>Size</label>
          <select onchange="updateCartLine(${i}, 'size', this.value)">
            ${line.sizes.map((s) => `<option value="${s}" ${s === line.size ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>`
      : '';

    div.innerHTML = `
      <div class="cart-line-name"><span>${line.name}${line.brand ? ' (' + line.brand + ')' : ''}</span>${removeBtn}</div>
      <div class="cart-line-fields">
        <div>
          <label>Quantity (in ${unit})</label>
          <input placeholder="e.g. 100 ${unit.toLowerCase()}" value="${line.quantity}"
            oninput="updateCartLine(${i}, 'quantity', this.value)">
        </div>
        ${sizeField}
      </div>
    `;

    container.appendChild(div);
  });
}

function updateCartLine(index, field, value) {
  cart[index][field] = value;
}

function removeCartLine(index) {
  cart.splice(index, 1);
  renderCart();
}

function addToCart(product) {
  cart.push({
    id: product.id,
    name: product.name,
    brand: product.brand,
    sizes: product.sizes || [],
    size: (product.sizes && product.sizes[0]) || null,
    quantity: '',
  });
  document.getElementById('product-search').value = '';
  document.getElementById('product-results').style.display = 'none';
  renderCart();
}

document.getElementById('product-search').addEventListener('input', function () {
  const query = this.value.trim().toLowerCase();
  const resultsBox = document.getElementById('product-results');

  if (!query) {
    resultsBox.style.display = 'none';
    resultsBox.innerHTML = '';
    return;
  }

  const matches = ALL_PRODUCTS.filter((p) =>
    [p.name, p.brand, p.category].filter(Boolean).join(' ').toLowerCase().includes(query)
  ).slice(0, 8);

  if (!matches.length) {
    resultsBox.style.display = 'none';
    resultsBox.innerHTML = '';
    return;
  }

  resultsBox.innerHTML = matches
    .map((p, i) => `<div class="product-result" data-index="${i}">${p.name}${p.brand ? ' (' + p.brand + ')' : ''}</div>`)
    .join('');
  resultsBox.style.display = 'block';

  Array.from(resultsBox.children).forEach((el, i) => {
    el.addEventListener('mousedown', () => addToCart(matches[i]));
  });
});

renderCart();

async function submitForm() {
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';

  const payload = {
    company_name: document.getElementById('company_name').value.trim(),
    contact_person: document.getElementById('contact_person').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim() || null,
    source_whatsapp_phone: SOURCE_WHATSAPP_PHONE,
    items: cart.map((line) => ({
      product_name: line.name,
      brand: line.brand,
      size: line.size,
      quantity: line.quantity.trim(),
    })),
    delivery_city: document.getElementById('delivery_city').value.trim(),
    pincode: document.getElementById('pincode').value.trim() || null,
    gst_number: document.getElementById('gst_number').value.trim() || null,
    notes: document.getElementById('notes').value.trim() || null,
  };

  if (!payload.company_name || !payload.contact_person || !payload.phone ||
      !payload.delivery_city || payload.items.some((i) => !i.quantity)) {
    errorEl.textContent = 'Please fill all required fields, including quantity for every product.';
    return;
  }

  const btn = document.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const res = await fetch('/quotation/public', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || data.detail || 'Submission failed.');
    }

    document.getElementById('form').style.display = 'none';
    document.getElementById('success').style.display = 'block';
  } catch (err) {
    errorEl.textContent = err.message;
    btn.disabled = false;
    btn.textContent = 'Submit Request';
  }
}
</script>
</body>
</html>"""


@router.get("/quote", response_class=HTMLResponse)
def public_quote_form(product: str, phone: str = ""):
    item = find_product(product)

    if item is None:
        raise HTTPException(status_code=404, detail="Product not found.")

    html = (
        PAGE_TEMPLATE.replace("__SOURCE_PHONE_JSON__", json.dumps(phone or None))
        .replace("__PHONE__", phone)
        .replace("__PRODUCT_ID_JSON__", json.dumps(item["id"]))
        .replace("__PRODUCT_NAME_JSON__", json.dumps(item["name"]))
        .replace("__PRODUCT_BRAND_JSON__", json.dumps(item.get("brand")))
        .replace("__PRODUCT_SIZES_JSON__", json.dumps(item.get("sizes") or []))
    )

    return HTMLResponse(content=html)
