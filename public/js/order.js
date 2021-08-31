'use strict';

document.querySelector('#lite-shop-order').onsubmit = event => {
  event.preventDefault();
  const username = document.querySelector('#username').value.trim();
  const phone = document.querySelector('#phone').value.trim();
  const email = document.querySelector('#email').value.trim();
  const address = document.querySelector('#address').value.trim();

  if (!document.querySelector('#rule').checked) {
    Swal.fire({
      title: 'Warning',
      text: 'Read and accept rules',
      type: 'info',
      confirmButtonText: 'Ok',
    });

    return;
  }

  if (username === '' || phone === '' || email === '' || address === '') {
    Swal.fire({
      title: 'Warning',
      text: 'Fill all fields',
      type: 'info',
      confirmButtonText: 'Ok',
    });

    return;
  }

  fetch('/finish-order', {
    method: 'POST',
    body: JSON.stringify({
      username,
      phone,
      email,
      address,
      key: JSON.parse(localStorage.getItem('cart')),
    }),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  })
  .then(response => response.text())
  .then(body => {
    if (body === '1') {
      Swal.fire({
        title: 'Success',
        text: 'Success',
        type: 'info',
        confirmButtonText: 'Ok',
      });
    } else {
      Swal.fire({
        title: 'Problem with email',
        text: 'Error',
        type: 'error',
        confirmButtonText: 'Ok',
      });
    }
  });
}