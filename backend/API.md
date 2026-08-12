# Restaurant POS V2 — API Documentation

**Base URL**: `http://localhost:4000/api`
**Auth**: Bearer token in `Authorization` header
**Format**: JSON request/response
**Conventions**:
- All responses: `{ ok: true|false, data: ... }` or `{ ok: false, code, message, details }`
- HTTP status: 200/201 success, 400 validation, 401 auth, 403 forbidden, 404 not found, 409 conflict, 500 server error
- Idempotency: POST/PUT/PATCH accept `Idempotency-Key` header (UUID v4) — duplicate requests return cached result

---

## Authentication

### POST /auth/login
Login with phone + PIN or phone + password.

**Body**:
```json
{
  "phone": "+998901234567",
  "pin": "1234",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"  // optional, for offline devices
}
```
**Response 200**:
```json
{
  "ok": true,
  "data": {
    "accessToken": "eyJhbG...",   // 15min
    "refreshToken": "eyJhbG...",  // 7d
    "user": { "id", "restaurantId", "roleId", "roleName" }
  }
}
```
**Errors**: 401 invalid credentials, 429 rate limit (10/min)

### POST /auth/refresh
Rotate tokens. Old refresh token is invalidated.

**Body**: `{ "refreshToken": "..." }`
**Response 200**: `{ accessToken, refreshToken }`

### POST /auth/logout
Revoke refresh token.

**Body**: `{ "refreshToken": "..." }` (optional)
**Response 200**: `{ loggedOut: true }`

### GET /auth/me
Get current user + permissions.

**Response 200**:
```json
{
  "ok": true,
  "data": {
    "id", "name", "phone", "restaurantId", "roleId", "roleName",
    "permissions": ["order.create", "menu.read", ...]
  }
}
```

---

## Users (admin)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | /users | staff.read | List users |
| POST | /users | staff.manage | Create user |
| GET | /users/:id | staff.read | Get user |
| PUT | /users/:id | staff.manage | Update user |
| DELETE | /users/:id | staff.manage | Deactivate (soft delete) |

**POST /users body**: `{ name, phone, pin?, password?, roleId, branchId?, deviceId? }`

---

## Roles & Permissions (admin)

| Method | Path | Permission |
|---|---|---|
| GET | /roles | staff.read |
| POST | /roles | role.manage |
| PUT | /roles/:id | role.manage |
| DELETE | /roles/:id | role.manage |
| GET | /roles/:id | staff.read |
| PUT | /roles/:id/permissions | role.manage |
| GET | /roles/permissions | staff.read |

---

## Tables

| Method | Path | Permission |
|---|---|---|
| GET | /tables | table.read |
| POST | /tables | table.manage |
| GET | /tables/:id | table.read |
| PUT | /tables/:id | table.manage |
| DELETE | /tables/:id | table.manage |
| POST | /tables/:id/free | table.force_free (admin) |

**GET /tables response** (single query via view — no N+1):
```json
{
  "ok": true,
  "data": [
    {
      "id", "name", "capacity", "section", "status",
      "current_order_id", "current_order_number",
      "current_order_total", "waiter_id", "waiter_name",
      "current_order_opened_at", "current_order_items", "sort_order"
    }
  ]
}
```

---

## Products & Categories

| Method | Path | Permission |
|---|---|---|
| GET | /products/categories | menu.read |
| POST | /products/categories | menu.manage |
| PUT | /products/categories/:id | menu.manage |
| DELETE | /products/categories/:id | menu.manage |
| GET | /products | menu.read |
| POST | /products | menu.manage |
| GET | /products/:id | menu.read |
| PUT | /products/:id | menu.manage |
| DELETE | /products/:id | menu.manage |
| PUT | /products/:id/price | menu.price |
| POST | /products/:id/variants | menu.manage |

---

## Orders (atomic transactions)

### POST /orders
Create order with items — ATOMIC transaction.

**Body**:
```json
{
  "tableId": "tbl_01_v2",      // optional
  "waiterId": null,            // defaults to caller
  "orderType": "dine_in",     // dine_in | takeaway | delivery
  "customerName": "...",
  "items": [
    {
      "productId": "prod_osh_plov_v2",
      "name": "Osh palov",     // snapshot at order time
      "unitPrice": 35000,
      "costPrice": 18000,
      "quantity": 2,
      "station": "kitchen"     // kitchen | kebab | bar
    }
  ],
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 201**: Full order with items.
**Response 200** (idempotent replay): `{ ok: true, idempotent: true, data: ... }`
**Errors**: 409 table occupied, 400 validation

### GET /orders?status=open&tableId=...
List orders with filters.

### GET /orders/:id
Get full order detail (items + events).

### POST /orders/:id/items
Add items to existing order — bumps version (optimistic lock).

**Body**: `{ items: [...] }`

### POST /orders/:id/items/:itemId/cancel
Cancel single item (with reason).

**Body**: `{ "reason": "Customer changed mind" }`

### POST /orders/:id/cancel
Cancel entire order (frees table).

### POST /orders/:id/send
Route pending items to kitchen/kebab stations — creates print jobs.

---

## Stations (kitchen / kebab / bar)

| Method | Path | Permission |
|---|---|---|
| GET | /station/:station/queue | station.{station}.view |
| PUT | /station/order-items/:id/status | station.{station}.view + order.item.status |

**Item status state machine**:
- pending → cooking (kitchen starts)
- cooking → ready (kitchen finishes)
- ready → served (waiter picks up)
- pending|cooking → cancelled (with reason)

**PUT /station/order-items/:id/status body**: `{ "status": "cooking" }`

---

## Payments (atomic transactions)

### POST /payments
Process payment — ATOMIC transaction:
1. Lock order (FOR UPDATE)
2. Check payment_status='unpaid' (idempotency)
3. Verify version (optimistic lock)
4. INSERT payment (UNIQUE on idempotency_key + order_id)
5. INSERT payment_items (per method)
6. UPDATE order → paid, version++
7. FREE table
8. UPDATE shift totals
9. INSERT inventory_transactions (consume recipes)
10. UPDATE inventory stock (decrement)
11. INSERT order_event 'paid'
12. INSERT print_jobs (receipt)

**Body**:
```json
{
  "orderId": "ord_...",
  "shiftId": "sft_...",        // optional
  "subtotal": 70000,
  "discountAmount": 0,
  "taxAmount": 0,
  "tipAmount": 0,
  "totalPaid": 70000,
  "changeAmount": 0,
  "paymentMethod": "cash",    // cash | click | payme | card | mixed
  "cashAmount": 70000,
  "cardAmount": 0,
  "clickAmount": 0,
  "paymeAmount": 0,
  "reference": "txn-id",       // optional
  "idempotencyKey": "uuid-v4",
  "version": 1,                // optimistic lock
  "cashierPrinterId": "printer_cashier_v2"
}
```
**Validation**: cashAmount + cardAmount + clickAmount + paymeAmount must equal totalPaid.

**Response 201**: `{ paymentId, orderId }`
**Response 200** (idempotent replay): `{ idempotent: true, data: { paymentId, orderId } }`
**Errors**: 409 version mismatch / already paid

### GET /payments?from=&to=&method=&cashierId=
List payments with filters.

### GET /payments/:id
Payment detail with payment_items.

### POST /payments/:id/refund (admin)
Refund a payment.

---

## Shifts

| Method | Path | Permission |
|---|---|---|
| GET | /shifts/current | shift.read |
| POST | /shifts/open | shift.open |
| POST | /shifts/:id/close | shift.close |
| GET | /shifts | shift.read |

---

## Inventory

| Method | Path | Permission |
|---|---|---|
| GET | /inventory | inventory.read |
| POST | /inventory | inventory.manage |
| PUT | /inventory/:id | inventory.manage |
| DELETE | /inventory/:id | inventory.manage |
| POST | /inventory/:id/adjust | inventory.adjust |
| GET | /inventory/transactions | inventory.read |
| POST | /inventory/purchases | purchase.manage |
| GET | /inventory/recipes | inventory.read |
| POST | /inventory/recipes | inventory.manage |
| PUT | /inventory/recipes/:id | inventory.manage |
| DELETE | /inventory/recipes/:id | inventory.manage |

---

## Reports

| Method | Path | Permission |
|---|---|---|
| GET | /reports/today | report.view |
| GET | /reports/range | report.view |
| GET | /reports/z-report | report.view |
| POST | /reports/z-report/close | report.zreport |
| GET | /reports/top-products | report.view |
| GET | /reports/by-waiter | report.view |

---

## Printers

| Method | Path | Permission |
|---|---|---|
| GET | /printers | staff.read |
| POST | /printers | printer.manage |
| PUT | /printers/:id | printer.manage |
| DELETE | /printers/:id | printer.manage |
| GET | /printers/routes | staff.read |
| POST | /printers/routes | printer.manage |
| DELETE | /printers/routes/:id | printer.manage |
| GET | /printers/print-jobs/pending | auth (any) |
| PUT | /printers/print-jobs/:id/status | auth (any) |
| POST | /printers/:id/test | printer.test |

---

## Audit & Backups

| Method | Path | Permission |
|---|---|---|
| GET | /audit-logs?userId=&entity=&action= | audit.read |
| GET | /backups | backup.manage |
| POST | /backups | backup.manage |
| GET | /backups/status | backup.manage |

---

## Sync (offline-first)

| Method | Path | Description |
|---|---|---|
| POST | /sync/push | Push batch of offline operations (idempotent) |
| GET | /sync/pull?since=ISO_TIMESTAMP | Pull deltas |
| GET | /sync/status?deviceId=UUID | Device sync status |

**POST /sync/push body**:
```json
{
  "deviceId": "uuid-v4",
  "operations": [
    {
      "idempotencyKey": "uuid-v4",
      "entity": "order",
      "operation": "create",
      "payload": { ... },
      "clientVersion": 0
    }
  ]
}
```
**Response**: `{ results: [...], serverTime }`

---

## Idempotency

All POST/PUT/PATCH endpoints accept `Idempotency-Key` header (UUID v4).
If a request with the same key has already been processed:
- Same response returned (HTTP 200 with `idempotent: true`)
- No side effects (no duplicate DB writes)

---

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| VALIDATION_ERROR | 400 | Body/query validation failed |
| UNAUTHORIZED | 401 | Missing/expired token |
| TOKEN_EXPIRED | 401 | JWT expired |
| FP_MISMATCH | 401 | Token fingerprint mismatch |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Optimistic lock conflict / state mismatch |
| DUPLICATE | 409 | UNIQUE constraint violation |
| LOCK_TIMEOUT | 503 | DB lock wait timeout (>5s) |
| DB_ERROR | 500 | Database operation failed |
| INTERNAL_ERROR | 500 | Unhandled server error |
| IDEMPOTENT_REPLAY | 200 | Duplicate request — cached result returned |

---

## Security

- **No DB credentials** exposed to frontend — all in backend `.env`
- **SQL injection**: all queries use mysql2 `?` parameter binding
- **RBAC**: every endpoint protected by `requirePerm('permission.code')`
- **Audit log**: every state-changing action logged in `audit_logs` table
- **Rate limiting**: 200 req/min/IP globally, 10 login attempts/min/IP
- **Helmet**: security headers (HSTS, CSP, X-Frame-Options)
- **CORS**: only configured origin allowed
- **JWT fingerprint**: token bound to IP + User-Agent hash
- **Refresh rotation**: refresh tokens are one-time use
