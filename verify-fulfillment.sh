#!/usr/bin/env bash
set -euo pipefail

ORDERS_BASE_URL="${ORDERS_BASE_URL:-http://localhost:8787}"
INVENTORY_BASE_URL="${INVENTORY_BASE_URL:-http://localhost:8791}"
FROM_DATE="${FROM_DATE:-2026-02-09}"
TO_DATE="${TO_DATE:-2026-02-15}"

orders_json="$(curl -sS "${ORDERS_BASE_URL}/api/v1/orders?from=${FROM_DATE}&to=${TO_DATE}")"

sku_csv="$(printf '%s' "$orders_json" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s);
  const set=new Set();
  for(const order of j.orders||[]){
    for(const item of order.line_items||[]){
      if(item.sku) set.add(item.sku);
    }
  }
  process.stdout.write(Array.from(set).join(","));
});')"

inventory_json="$(curl -sS -H "X-Warehouse: primary" "${INVENTORY_BASE_URL}/api/v2/inventory/availability?sku=${sku_csv}")"

result_json="$(node -e '
const orders=JSON.parse(process.argv[1]);
const inventory=JSON.parse(process.argv[2]);
const required={};
for(const order of orders.orders||[]){
  for(const item of order.line_items||[]){
    if(!item.sku) continue;
    required[item.sku]=(required[item.sku]||0)+Number(item.quantity||0);
  }
}
const available=inventory.availability||{};
const shortages=[];
for(const [sku,qty] of Object.entries(required)){
  const have=Number(available[sku]||0);
  if(have<qty) shortages.push({sku,required:qty,available:have,missing:qty-have});
}
const canFulfill=shortages.length===0;
process.stdout.write(JSON.stringify({canFulfill,required,available,shortages}));
' "$orders_json" "$inventory_json")"

echo "$result_json" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const r=JSON.parse(s);
  console.log(JSON.stringify(r,null,2));
  if(r.canFulfill!==false) {
    console.error("Expected canFulfill=false for demo data");
    process.exit(1);
  }
  const skuC=r.shortages.find(x=>x.sku==="SKU_C");
  if(!skuC || skuC.missing!==2){
    console.error("Expected SKU_C shortage of 2 for demo data");
    process.exit(1);
  }
});'

echo "Fulfillment verification complete."
