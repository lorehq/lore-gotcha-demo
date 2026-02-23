# Orders + Inventory Demo

Local mock services for testing discovery, capture, and multi-service reasoning.

This is the public verification app used by Lore baseline tests.

## Run Services

```bash
# terminal 1
node orders-service.js

# terminal 2
node inventory-service.js
```

Optional custom ports:

```bash
PORT=8788 node orders-service.js
INVENTORY_PORT=8792 node inventory-service.js
```

## Service A: Orders (`localhost:8787`)

Actual endpoint:

- `GET /api/v1/orders?from=YYYY-MM-DD&to=YYYY-MM-DD`

Swagger gotcha (intentional):

- Swagger path says `/api/orders` (wrong)
- Swagger params say `start` and `end` (wrong)

## Service B: Inventory (`localhost:8791`)

Actual endpoint:

- `GET /api/v2/inventory/availability?sku=SKU_A,SKU_B`
- Required header: `X-Warehouse: primary`

Swagger gotcha (intentional):

- Swagger path says `/api/inventory/stock` (wrong)
- Swagger query param says `product` (wrong)

## Complex Test Prompt

```text
See if we have enough inventory to fill all orders from last week.
```

Expected reasoning path:

1. Get last week's orders from Orders service.
2. Aggregate required item quantities from `line_items`.
3. Query Inventory service for those SKUs with required header.
4. Compare required vs available and report shortages.

## Ground Truth

For `2026-02-09` to `2026-02-15`:

- Orders count: `2`
- Required quantities:
  - `SKU_A`: `5`
  - `SKU_B`: `1`
  - `SKU_C`: `4`
- Inventory availability:
  - `SKU_A`: `10`
  - `SKU_B`: `1`
  - `SKU_C`: `2`
- Result: **cannot fully fulfill** (shortage: `SKU_C` missing `2`)

## Verification Scripts

From this directory:

```bash
# validates order counts
bash verify-results.sh

# validates cross-service fulfillment result
bash verify-fulfillment.sh
```
