'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('CURRENT BEHAVIOUR: order pricing applies HSN rates and coupon to subtotal before tax', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];

  var totals = pricing.computeTotals(items, 'WELCOME');

  assert.deepEqual(totals, {
    subtotal: 200,
    discount: 10,
    taxable: 190,
    tax: 21.85,
    cgst: 10.93,
    sgst: 10.92,
    total: 211.85,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 100, discount: 5, taxable: 95, tax: 4.75, net: 99.75 },
      { id: 2, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 100, discount: 5, taxable: 95, tax: 17.1, net: 112.1 }
    ]
  });
});

test('invoice uses the same HSN rates and post-discount tax basis as order pricing', function () {
  // This is the shape saved by routes/orders.js: HSN is present, gstRate is not.
  var orderSnapshot = {
    id: 1001,
    coupon: 'WELCOME',
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { id: 2, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
    ]
  };

  var figures = invoice.computeInvoiceFigures(orderSnapshot);
  assert.deepEqual(figures, {
    subtotal: 200,
    discount: 10,
    tax: 21.85,
    cgst: 10.93,
    sgst: 10.92,
    total: 211.85,
    rows: [
      { name: 'Rice', sku: '-', hsn: '1006', qty: 1, price: 100, gstPercent: 5, line: 100, lineTax: 4.75 },
      { name: 'Tea', sku: '-', hsn: '0902', qty: 1, price: 100, gstPercent: 18, line: 100, lineTax: 17.1 }
    ]
  });
});

test('rendered invoice agrees with the billed order total', function () {
  var html = invoice.render({
    id: 1001,
    coupon: 'WELCOME',
    total: 211.85,
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Tea', hsn: '0902', price: 100, qty: 1 }
    ]
  });

  assert.match(html, /Invoice Total<\/td><td class="r">₹211\.85/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice preserves fractional decimal gstRate values', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Sample', price: 10, qty: 1, gstRate: 0.05 }]
  });

  assert.deepEqual(figures.rows[0], {
    name: 'Sample', sku: '-', hsn: '-', qty: 1, price: 10,
    gstPercent: 5, line: 10, lineTax: 0.5
  });
  assert.equal(figures.tax, 0.5);
});
