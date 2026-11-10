/* Payment result page: reads ?ok=1|0&ref=ORD-12345&demo=1 from the address. */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var ok = q.get('ok') === '1';
  var ref = (q.get('ref') || '').replace(/[^A-Z0-9-]/gi, '').toUpperCase();
  var demo = q.get('demo') === '1';
  var $ = function (id) { return document.getElementById(id); };
  if (ref) $('resRef').textContent = 'Order ' + ref;
  if (ok) {
    $('resEyebrow').textContent = demo ? 'Demo payment approved' : 'Payment received';
    $('resTitle').innerHTML = 'Thank you.<br><em>It is on its way.</em>';
    $('resText').textContent = demo
      ? 'This was a DEMO payment. No money moved. On the live site the customer sees this page after paying on PayFast.'
      : 'We are confirming your payment with PayFast. We will contact you about delivery shortly.';
  } else {
    $('resEyebrow').textContent = demo ? 'Demo payment declined' : 'Payment not completed';
    $('resTitle').innerHTML = 'No payment<br><em>was taken.</em>';
    $('resText').textContent = 'Your order is saved. You can try again, pay by bank transfer, or WhatsApp us and we will help.';
    $('resBtn').textContent = 'Try again';
  }
})();
