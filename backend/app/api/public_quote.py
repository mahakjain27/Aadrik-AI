import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from app.services.lead_scoring import categorize_quantity
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
  .product {
    font-size: 14px;
    color: #52514e;
    margin: 0 0 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(11,11,11,0.08);
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
  #success h2 { color: #198754; }
</style>
</head>
<body>
  <div class="card">
    <h1>Aadrik Distributors</h1>
    <p class="product">__PRODUCT_LABEL__</p>

    <div id="form">
      <label>Company Name *</label>
      <input id="company_name" required>

      <label>Contact Person *</label>
      <input id="contact_person" required>

      <label>Phone Number *</label>
      <input id="phone" value="__PHONE__" required>

      <label>Email</label>
      <input id="email" type="email">

      __SIZE_FIELD__

      <label>Quantity Required * (in __UNIT__)</label>
      <input id="quantity" placeholder="e.g. 100 __UNIT_LOWER__" required>

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
      <p>Our sales team will contact you shortly.</p>
    </div>
  </div>

<script>
const PRODUCT_NAME = __PRODUCT_NAME_JSON__;
const PRODUCT_BRAND = __PRODUCT_BRAND_JSON__;

async function submitForm() {
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';

  const sizeEl = document.getElementById('size');

  const payload = {
    company_name: document.getElementById('company_name').value.trim(),
    contact_person: document.getElementById('contact_person').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim() || null,
    product_name: PRODUCT_NAME,
    brand: PRODUCT_BRAND,
    size: sizeEl ? sizeEl.value : null,
    quantity: document.getElementById('quantity').value.trim(),
    delivery_city: document.getElementById('delivery_city').value.trim(),
    pincode: document.getElementById('pincode').value.trim() || null,
    gst_number: document.getElementById('gst_number').value.trim() || null,
    notes: document.getElementById('notes').value.trim() || null,
  };

  if (!payload.company_name || !payload.contact_person || !payload.phone ||
      !payload.quantity || !payload.delivery_city) {
    errorEl.textContent = 'Please fill all required fields.';
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

    _key, _label, unit = categorize_quantity(item["name"])
    sizes = item.get("sizes") or []

    if sizes:
        options = "".join(f'<option value="{s}">{s}</option>' for s in sizes)
        size_field = f'<label>Size</label><select id="size">{options}</select>'
    else:
        size_field = ""

    product_label = item["name"]
    if item.get("brand"):
        product_label += f" ({item['brand']})"

    html = (
        PAGE_TEMPLATE.replace("__PRODUCT_LABEL__", product_label)
        .replace("__PHONE__", phone)
        .replace("__SIZE_FIELD__", size_field)
        .replace("__UNIT__", unit)
        .replace("__UNIT_LOWER__", unit.lower())
        .replace("__PRODUCT_NAME_JSON__", json.dumps(item["name"]))
        .replace("__PRODUCT_BRAND_JSON__", json.dumps(item.get("brand")))
    )

    return HTMLResponse(content=html)
