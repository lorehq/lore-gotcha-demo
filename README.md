# Lore Gotcha Demo

Mock API services with deliberate gotchas for testing AI agent discovery, knowledge capture, and multi-service reasoning. This is the public verification repo used for [Lore's cost evidence](https://lorehq.github.io/lore-docs/cost-evidence/).

## Quick Start

> **Tip:** Your agent can set up and run this entire test for you. Clone the repo and tell your agent to start the services and run verification.

```bash
git clone https://github.com/lorehq/lore-gotcha-demo.git
cd lore-gotcha-demo

# Start both services (separate terminals)
node orders-service.js
node inventory-service.js

# Verify services are working
bash verify-results.sh
bash verify-fulfillment.sh
```

Requires Node.js 18+.

## The Task

> See if we have enough inventory to fill all orders from last week.

The agent must discover two APIs, navigate deliberate Swagger misdirection, aggregate order quantities, query inventory with a required header, and compare the results. The task is simple for a human but exercises the agent's ability to handle API gotchas, recover from bad documentation, and reason across multiple services.

## Services

### Orders Service (`localhost:8787`)

**Correct endpoint:**
```
GET /api/v1/orders?from=YYYY-MM-DD&to=YYYY-MM-DD
```

**Swagger misdirection (intentional):**

| What Swagger says | What actually works |
|-------------------|---------------------|
| Path: `/api/orders` | Path: `/api/v1/orders` |
| Params: `start`, `end` | Params: `from`, `to` |

Hitting `/api/orders` returns a 404 with a hint: `"Use /api/v1/orders with from and to query params (YYYY-MM-DD)"`.

**Sample response:**
```json
{
  "service": "orders-service",
  "count": 2,
  "from": "2026-02-09",
  "to": "2026-02-15",
  "orders": [
    {
      "id": "ord_1001",
      "customer": "Acme Co",
      "total_cents": 12900,
      "created_at": "2026-02-10",
      "line_items": [
        { "sku": "SKU_A", "quantity": 3 },
        { "sku": "SKU_B", "quantity": 1 }
      ]
    },
    {
      "id": "ord_1002",
      "customer": "Globex",
      "total_cents": 4599,
      "created_at": "2026-02-14",
      "line_items": [
        { "sku": "SKU_A", "quantity": 2 },
        { "sku": "SKU_C", "quantity": 4 }
      ]
    }
  ]
}
```

Custom port: `PORT=8788 node orders-service.js`

### Inventory Service (`localhost:8791`)

**Correct endpoint:**
```
GET /api/v2/inventory/availability?sku=SKU_A,SKU_B
Header: X-Warehouse: primary
```

**Swagger misdirection (intentional):**

| What Swagger says | What actually works |
|-------------------|---------------------|
| Path: `/api/inventory/stock` | Path: `/api/v2/inventory/availability` |
| Param: `product` | Param: `sku` (comma-separated) |
| No header mentioned | Requires `X-Warehouse: primary` |

Hitting `/api/inventory/stock` returns a 404 with a hint. Calling the correct path without the header returns a 400 with the required header name.

**Sample response:**
```json
{
  "service": "inventory-service",
  "warehouse": "primary",
  "availability": {
    "SKU_A": 10,
    "SKU_B": 1,
    "SKU_C": 2
  }
}
```

Custom port: `INVENTORY_PORT=8792 node inventory-service.js`

## Ground Truth

For orders from `2026-02-09` to `2026-02-15`:

| Step | Data |
|------|------|
| Orders in range | 2 (ord_1001, ord_1002) |
| Required: SKU_A | 5 (3 + 2) |
| Required: SKU_B | 1 |
| Required: SKU_C | 4 |
| Available: SKU_A | 10 |
| Available: SKU_B | 1 |
| Available: SKU_C | 2 |
| **Result** | **Cannot fully fulfill** |
| **Shortage** | **SKU_C: need 4, have 2, missing 2** |

## Calculation Runbook

The correct reasoning path for the fulfillment check:

1. **Fetch orders** — `GET /api/v1/orders?from=2026-02-09&to=2026-02-15` returns 2 orders
2. **Aggregate line items** — Sum quantities per SKU across all orders:
   - ord_1001: SKU_A=3, SKU_B=1
   - ord_1002: SKU_A=2, SKU_C=4
   - **Totals: SKU_A=5, SKU_B=1, SKU_C=4**
3. **Query inventory** — `GET /api/v2/inventory/availability?sku=SKU_A,SKU_B,SKU_C` with `X-Warehouse: primary` header
4. **Compare required vs available** for each SKU:
   - SKU_A: need 5, have 10 — sufficient
   - SKU_B: need 1, have 1 — sufficient
   - SKU_C: need 4, have 2 — **shortage of 2**
5. **Report** — Cannot fully fulfill. SKU_C is short by 2 units.

## Expected Agent Discovery Path

An agent encountering these services cold will typically:

1. Hit `/swagger.json` on both services (or `/swagger` for the HTML page)
2. Try the Swagger-documented paths (`/api/orders`, `/api/inventory/stock`) — both return 404s with hints
3. Follow the hints to the correct versioned paths
4. Discover the required `X-Warehouse: primary` header on the inventory service (via error response)
5. Discover the correct query parameter names (`from`/`to` instead of `start`/`end`, `sku` instead of `product`)

This discovery path typically costs 17-32 API requests when the agent starts cold. With prior knowledge (skills documenting the gotchas), the agent goes directly to the correct endpoints on the first attempt.

## Results

The [`results/`](results/) directory contains the full raw data from all 50 test sessions:

- **[Raw Session Data](results/raw-data.md)** — Per-session token, cache, model, and cost breakdowns
- **[Analysis](results/analysis.md)** — Findings, cost progression, variance, cumulative ROI
- **[Methodology](results/methodology.md)** — Test design, pricing basis, measurement approach
- **[Operator Inputs](results/operator-inputs.md)** — Exact operator messages for each condition

These same files are published on the [Lore docs site](https://lorehq.github.io/lore-docs/cost-evidence/).

## Reproducing the Cost Evidence Test

> **Tip:** Your agent can help set up and coordinate the test runs below. Tell it which condition you want to run and it handles instance creation, Docker setup, and log collection.

The [Lore cost evidence](https://lorehq.github.io/lore-docs/cost-evidence/) was measured using these services across 50 Claude Code sessions in 5 conditions. Below is how to reproduce it.

### Prerequisites

- Node.js 18+
- Claude Code (CLI)
- [Lore](https://github.com/lorehq/lore) installed via `npx create-lore`
- Docker (for semantic search sidecar — the test used full Lore integration)

### Test Configuration

The original test used **full Lore integration**, not the out-of-the-box default:

- **Lore v0.11.0** with all hooks active
- **Docker sidecar running** (`/lore-docker`) — semantic search and docs UI enabled
- **MCP search server configured** (`.mcp.json`)
- **Standard hook profile** (nudge + warn thresholds active)
- **Opus 4.6 orchestrator**, **Haiku 4.5 workers**
- **Claude Max subscription** (flat-rate — cost figures are API-equivalent estimates)

### Conditions

Run 10 sessions per condition, same task, same day:

| Condition | Setup | Prior Knowledge | Operator Input |
|-----------|-------|-----------------|----------------|
| **Raw Cold** | No Lore. Fresh workspace with unrelated CLAUDE.md (cache-breaker). | None | Task prompt + service URLs |
| **Lore Cold** | Fresh Lore instance per session (lore-01..10). Empty knowledge base. | None | Task prompt + clarification + capture approval |
| **Lore Warm** | Same instances. Knowledge from cold persists. | Skills + env docs | Task prompt only |
| **Lore Hot** | Same instances. Knowledge from cold+warm. Operator requests runbook after answer. | Skills + env docs | Task prompt + runbook request |
| **Lore Runbook** | Same instances. Full knowledge stack. | Skills + env docs + runbook | One word: "fulfillment" |

### Operator Inputs (Exact Messages)

**All conditions — Message 1 (task prompt):**
```
See if we have enough inventory to fill all orders from last week.
```

**Raw Cold — Message 2 (after agent asks for service locations):**
```
Orders service is at http://localhost:8787. Inventory service is at http://localhost:8791.
```

**Lore Cold — Message 2 (clarification, slight wording variation across sessions):**
```
1. Orders service is at http://localhost:8787. Inventory service is at http://localhost:8791.
2. LAST week.
3. duh
```

**Lore Cold — Message 3 (capture approval):**
```
yes
```

**Lore Hot — Message 2 (runbook creation request):**
```
create a runbook for this, using the prior business week up until end of business
on the previous friday from when the run occurs. Make sure the runbook includes
the appropriate skills and uses delegation for the whole operation.
```

**Lore Runbook — Message 1 (minimal trigger):**
```
fulfillment
```

### Raw Cold Setup

Create a workspace with no Lore. Add a `CLAUDE.md` with unrelated content (e.g., a TypeScript project description) to serve as a cache-breaker — this prevents the prompt cache from carrying task-relevant context between sessions.

### Lore Cold Setup

```bash
# Create 10 separate Lore instances
for i in $(seq -w 1 10); do
  npx create-lore "lore-${i}"
done
```

Start the Docker sidecar in each instance before running sessions:
```bash
# In each instance, start semantic search + docs UI
# (use /lore-docker from within a session, or docker compose directly)
```

### Measuring Cost

Token usage comes from Claude Code's JSONL session logs. Each session produces a log at `~/.claude/projects/<project-hash>/<session-id>.jsonl` containing:

- `usage` events with `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`
- `model` field identifying which model (Opus/Haiku) processed each request
- `durationMs` in system events for execution time

**Cost formula per request:**
```
cost = (input_tokens * input_rate)
     + (output_tokens * output_rate)
     + (cache_read_input_tokens * cache_read_rate)
     + (cache_creation_input_tokens * cache_create_rate)
```

**Pricing (per MTok, as of Feb 2026):**

| Model | Input | Output | Cache Read | Cache Create |
|-------|-------|--------|------------|--------------|
| Opus 4.6 | $5.00 | $25.00 | $0.50 | $6.25 |
| Haiku 4.5 | $1.00 | $5.00 | $0.10 | $1.25 |

**Cost split:** The boundary between "answer" and "capture" cost is the timestamp of the earliest Write/Edit operation targeting `/skills/`, `/knowledge/environment/`, or `/knowledge/runbooks/`. Everything before = answer cost; everything after = capture cost.

**Token deduplication:** Claude Code emits duplicate usage entries during streaming (one per content block in multi-block responses). Deduplicate by composite key: `requestId + message.id + input_tokens + output_tokens + cache_read_input_tokens + cache_creation_input_tokens`.

### Execution Time

Use `durationMs` from Claude Code's system events — the per-turn active processing timer. This measures actual model computation, excluding idle time between turns. Split into answer/capture using the same boundary as cost.

## Verification Scripts

```bash
# Validate order counts for known date ranges
bash verify-results.sh

# Validate cross-service fulfillment result (the full calculation)
bash verify-fulfillment.sh
```

Both scripts use the correct API endpoints with correct parameters and headers, then assert against the known ground truth. If both pass, the services are working correctly.

Custom service URLs:
```bash
BASE_URL=http://localhost:8788 bash verify-results.sh
ORDERS_BASE_URL=http://localhost:8788 INVENTORY_BASE_URL=http://localhost:8792 bash verify-fulfillment.sh
```

Custom date range:
```bash
FROM_DATE=2026-02-13 TO_DATE=2026-02-20 bash verify-fulfillment.sh
```

## License

MIT
