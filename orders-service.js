const http = require("http");
const { URL } = require("url");

const port = Number(process.env.PORT || 8787);

const orders = [
  {
    id: "ord_1001",
    customer: "Acme Co",
    total_cents: 12900,
    created_at: "2026-02-10",
    line_items: [
      { sku: "SKU_A", quantity: 3 },
      { sku: "SKU_B", quantity: 1 },
    ],
  },
  {
    id: "ord_1002",
    customer: "Globex",
    total_cents: 4599,
    created_at: "2026-02-14",
    line_items: [
      { sku: "SKU_A", quantity: 2 },
      { sku: "SKU_C", quantity: 4 },
    ],
  },
  {
    id: "ord_1003",
    customer: "Initech",
    total_cents: 2500,
    created_at: "2026-02-17",
    line_items: [{ sku: "SKU_B", quantity: 2 }],
  },
  {
    id: "ord_1004",
    customer: "Umbrella",
    total_cents: 8800,
    created_at: "2026-02-19",
    line_items: [{ sku: "SKU_C", quantity: 1 }],
  },
];

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function handleOrders(url, res) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!from || !to) {
    sendJson(res, 400, {
      error: "Missing required query parameters",
      required: ["from", "to"],
      format: "YYYY-MM-DD",
    });
    return;
  }

  if (!validDate(from) || !validDate(to)) {
    sendJson(res, 400, {
      error: "Invalid date format",
      required_format: "YYYY-MM-DD",
      received: { from, to },
    });
    return;
  }

  const filtered = orders.filter((order) => order.created_at >= from && order.created_at <= to);
  sendJson(res, 200, {
    service: "orders-service",
    count: filtered.length,
    from,
    to,
    orders: filtered,
  });
}

function swaggerDoc(baseUrl) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Orders Service API",
      version: "1.0.0",
      description: "Demo API for fetching orders by date range",
    },
    servers: [{ url: baseUrl }],
    paths: {
      "/api/orders": {
        get: {
          summary: "List orders in date range",
          description: "Returns orders for a date range",
          parameters: [
            {
              name: "start",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
            },
            {
              name: "end",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
            },
          ],
          responses: {
            200: { description: "Order list" },
          },
        },
      },
    },
  };
}

const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Orders Service Swagger</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; }
      code { background: #f3f4f6; padding: 0.2rem 0.4rem; }
    </style>
  </head>
  <body>
    <h1>Orders Service</h1>
    <p>Swagger JSON: <a href="/swagger.json"><code>/swagger.json</code></a></p>
    <p>Docs endpoint only. No UI bundle included.</p>
  </body>
</html>`;

const server = http.createServer((req, res) => {
  const host = req.headers.host || `localhost:${port}`;
  const url = new URL(req.url, `http://${host}`);

  if (url.pathname === "/swagger") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(swaggerHtml);
    return;
  }

  if (url.pathname === "/swagger.json") {
    sendJson(res, 200, swaggerDoc(`http://${host}`));
    return;
  }

  if (url.pathname === "/api/v1/orders" && req.method === "GET") {
    handleOrders(url, res);
    return;
  }

  if (url.pathname === "/api/orders") {
    sendJson(res, 404, {
      error: "Not found",
      hint: "Use /api/v1/orders with from and to query params (YYYY-MM-DD)",
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`Orders service running at http://localhost:${port}`);
  console.log(`Swagger page: http://localhost:${port}/swagger`);
});
