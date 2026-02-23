const http = require("http");
const { URL } = require("url");

const port = Number(process.env.INVENTORY_PORT || 8791);

const stockBySku = {
  SKU_A: 10,
  SKU_B: 1,
  SKU_C: 2,
};

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function swaggerDoc(baseUrl) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Inventory Service API",
      version: "1.0.0",
      description: "Demo API for stock lookup by product",
    },
    servers: [{ url: baseUrl }],
    paths: {
      "/api/inventory/stock": {
        get: {
          summary: "Get stock by product",
          parameters: [
            {
              name: "product",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: { description: "Stock result" },
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
    <title>Inventory Service Swagger</title>
  </head>
  <body>
    <h1>Inventory Service</h1>
    <p>Swagger JSON: <a href="/swagger.json"><code>/swagger.json</code></a></p>
  </body>
</html>`;

function handleAvailability(url, req, res) {
  const warehouse = req.headers["x-warehouse"] || "";
  if (warehouse !== "primary") {
    sendJson(res, 400, {
      error: "Missing or invalid header",
      required_header: "X-Warehouse: primary",
      hint: "Use /api/v2/inventory/availability?sku=SKU_A,SKU_B with header X-Warehouse: primary",
    });
    return;
  }

  const rawSku = url.searchParams.get("sku");
  if (!rawSku) {
    sendJson(res, 400, {
      error: "Missing required query parameter",
      required: "sku",
      format: "comma-separated SKU list",
    });
    return;
  }

  const skus = rawSku
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const availability = {};
  for (const sku of skus) {
    availability[sku] = Object.prototype.hasOwnProperty.call(stockBySku, sku) ? stockBySku[sku] : 0;
  }

  sendJson(res, 200, {
    service: "inventory-service",
    warehouse: "primary",
    availability,
  });
}

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

  if (url.pathname === "/api/v2/inventory/availability" && req.method === "GET") {
    handleAvailability(url, req, res);
    return;
  }

  if (url.pathname === "/api/inventory/stock") {
    sendJson(res, 404, {
      error: "Not found",
      hint: "Use /api/v2/inventory/availability?sku=SKU_A,SKU_B with header X-Warehouse: primary",
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`Inventory service running at http://localhost:${port}`);
  console.log(`Swagger page: http://localhost:${port}/swagger`);
});
