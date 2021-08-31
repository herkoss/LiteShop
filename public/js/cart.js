'use strict';

let cart = {};

document.querySelectorAll('.add-to-cart').forEach(element => {
  element.onclick = addToCart;
});

if (localStorage.getItem('cart')) {
  cart = JSON.parse(localStorage.getItem('cart'));
  ajaxGetGoodsInfo();
}

function addToCart() {
  const goodsId = this.dataset.goods_id;

  if (cart[goodsId]) {
    cart[goodsId]++;
  } else {
    cart[goodsId] = 1;
  }

  ajaxGetGoodsInfo();
}

function ajaxGetGoodsInfo() {
  updateLocalStorageCart();
  fetch('/get-goods-info', {
    method: 'POST',
    body: JSON.stringify({key: Object.keys(cart)}),
    headers: {
      'Accept' : 'application/json',
      'Content-Type' : 'application/json',
    },
  })
  .then(response => response.text())
  .then(body => {
    showCart(JSON.parse(body));
  });
}

function showCart(cartDescription) {
  let out = '<table class="table table-striped table-cart"><tbody>';
  let total = 0;

  for (let key in cart) {
    out += `<tr><td colspan="4"><a href="/goods?id=${key}">${cartDescription[key]['name']}</a></tr>`;
    out += `<tr><td><button class="plus-count" data-goods_id="${key}">+</button></td>`
    out += `<td>${cart[key]}</td>`;
    out += `<td><button class="minus-count" data-goods_id="${key}">-</button></td>`;
    out += `<td>${formatPrice(cartDescription[key]['cost'] * cart[key])} uah</td>`;
    out += '</tr>';
    total += cart[key] * cartDescription[key]['cost'];
  }
  out += `<tr><td colspan="3">Total: </td><td>${formatPrice(total)} uah</td></tr>`;
  out += '</tbody></table>';

  document.querySelector('#cart-nav').innerHTML = out;

  document.querySelectorAll('.minus-count').forEach(element => element.onclick = cartMinus);
  document.querySelectorAll('.plus-count').forEach(element => element.onclick = cartPlus);
}

function cartPlus() {
  const goodsId = this.dataset.goods_id;
  cart[goodsId]++;
  ajaxGetGoodsInfo();
}

function cartMinus() {
  const goodsId = this.dataset.goods_id;

  if (cart[goodsId] - 1 > 0) {
    cart[goodsId]--;
  } else {
    delete cart[goodsId];
  }
  ajaxGetGoodsInfo();
}

function updateLocalStorageCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function formatPrice(price) {
  return price.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$& ');
}
