'use strict';

const nodemailer = require('nodemailer');
const express = require('express');
const cookie = require('cookie');
const mysql = require('mysql'); 
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const admin = require('./admin.js');
const { request, response } = require('express');

const app = express();

// public - name of the folder with static files
app.use(express.static('public'))

// template engine
app.set('view engine', 'pug');

// connecting json for POST queries
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// seting module
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Root_r00t',
  database: 'market'
});

app.listen(3000, () => {
  console.log('Node express work on 3000');
});

app.use((request, response, next) => {
  if (request.originalUrl === '/admin' || request.originalUrl === '/admin-order') {
    admin(request, response, connection, next);
  } else {
    next();
  }
});

app.get('/', (request, response) => {
  const category = new Promise((resolve, reject) => {
    connection.query(
      "SELECT id, slug, name, cost, image, category FROM (SELECT id, slug, name, cost, image, category, IF("
      + "IF(@curr_category != category, @curr_category := category, '') != '', @k := 0, @k := @k + 1)"
      +" as ind FROM goods, (SELECT @curr_category := '') v ) goods WHERE ind < 3",
      (error, result, fields) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      }
    );
  });

  const categoryDescription = new Promise((resolve, reject) => {
    connection.query('SELECT * FROM category',(error, result, fields) => {
      if (error) {
        return reject(error);
      }

      resolve(result);
    });
  });

  Promise.all([category, categoryDescription]).then(value => {
    response.render('index', {
      goods: JSON.parse(JSON.stringify(value[0])),
      category: JSON.parse(JSON.stringify(value[1])),
    });
  });
});

app.get('/category', (request, response) => {
  const categoryID = request.query.id;

  const category = new Promise(function (resolve, reject) {
    connection.query('SELECT * FROM category WHERE id=' + categoryID, (error, result) => {
      if (error) {
        reject(error);
      }

      resolve(result);
    });
  });

  const goods = new Promise(function (resolve, reject) {
    connection.query('SELECT * FROM goods WHERE category=' + categoryID, (error, result) => {
      if (error) {
        reject(error);
      }

      resolve(result);
    });
  });

  Promise.all([category, goods]).then(value => {
    response.render('category', {
      category: JSON.parse(JSON.stringify(value[0])),
      goods: JSON.parse(JSON.stringify(value[1])),
    });
  });

});

app.get('/goods/*', (request, response) => {
  console.log(request.params['0']);
  connection.query(`SELECT * FROM goods WHERE slug="${request.params['0']}"`, (error, result) => {
    if (error) {
      throw error;
    }
    console.log(result);
    response.render('goods', {
      'goods': JSON.parse(JSON.stringify(result)),
    });
  });
});

app.get('/order', (request, response) => {
  response.render('order');
});

app.post('/get-category-list', (request, response) => {
  connection.query('SELECT id, category FROM category', (error, result, fields) => {
    if (error) {
      throw error;
    }

    response.json(result);
  });
});

app.post('/get-goods-info', (request, response) => {
  if (request.body.key.length !== 0) {
    connection.query(
      'SELECT id, name, cost FROM goods WHERE id IN (' + request.body.key.join(', ') + ')',
      (error, result, fields) => {
        if (error) {
          throw error;
        }

        const goods = {};

        for (let i = 0; i < result.length; i++) {
          goods[result[i]['id']] = result[i];
        }

        response.json(goods);
      }
    );
  } else {
    response.send('0');
  }
});

app.post('/finish-order', (request, response) => {
  if (request.body.key.length !== 0) {
    const key = Object.keys(request.body.key);

    connection.query('SELECT id, name, cost FROM goods WHERE id IN (' + key.join(', ') + ')', (error, result, fields) => {
      if (error) throw error;
      sendMail(request.body, result).catch(console.error);
      saveOrder(request.body, result);
      response.send('1');
    });
  } else {
    response.send('0');
  }
});

app.get('/admin', (request, response) => {
  response.render('admin', {});
});

app.get('/admin-order', (request, response) => {
  connection.query(`
    SELECT
      shop_order.id as id,
      shop_order.user_id as user_id,
      shop_order.goods_id as goods_id,
      shop_order.goods_cost as goods_cost,
      shop_order.goods_amount as goods_amount,
      shop_order.total as total,
      from_unixtime(shop_order.date, "%Y-%M-%D %h:%m") as timestamp,
      user_info.user_name as user_name,
      user_info.user_phone as user_phone,
      user_info.address as user_address
    FROM shop_order
    LEFT JOIN user_info
    ON shop_order.user_id = user_info.id
    ORDER BY id DESC
    `,
    (error, result, field) => {
      if (error) throw error;
      response.render('admin-order', { orders: JSON.parse(JSON.stringify(result)) });
    }
  );
});

app.get('/admin-goods', (request, response) => {});

app.get('/login', (request, response) => {
  response.render('login', {});
});

app.post('/login', (request, response) => {
  connection.query(`
    SELECT *
    FROM user
    WHERE login="${request.body.login}" AND password="${request.body.password}"`,
    (error, result, fields) => {
      if (error) throw error;
      if (result.length === 0) {
        console.log('User not fount');
        response.redirect('/login');
      } else {
        const hash = makeHash(32);
        response.cookie('hash', hash);
        response.cookie('id', result[0].id);
        connection.query(
          `UPDATE user SET hash="${hash}" WHERE id=${result[0].id}`,
          (error, result, fields) => {
            if (error) throw error;
            response.redirect('/admin');
          }
        );
      }
    }
  );
});

async function sendMail(data, result) {
  let message = '<h2>Order in lite shop</h2>';
  let total = 0;

  for (let i = 0; i < result.length; i++) {
    message += `<p>${result[i]['name']} - ${data.key[result[i]['id']]} - ${result[i]['cost'] * data.key[result[i]['id']]} uah</p>`;
    total += result[i]['cost'] * data.key[result[i]['id']];
  }

  message += '<hr>';
  message += `Total ${total} uah`;
  message += '<hr>';
  message += `<hr> Phone: ${data.phone}`;
  message += `<hr> User: ${data.username}`;
  message += `<hr> Address: ${data.address}`;
  message += `<hr> Email: ${data.email}`;

  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  const mailOption = {
    from: '<herkodmytro@gmail.com>',
    to: 'herkodmytro@gmail.com,' + data.email,
    subject: 'LiteShop order',
    text: 'Hello world',
    html: message,
  };

  const info = await transporter.sendMail(mailOption);
}

function saveOrder(data, result) {
  let sqlQuery = `
    INSERT INTO user_info (user_name, user_phone, user_email, address)
    VALUES ('${data.username}', '${data.phone}', '${data.email}', '${data.address}')
  `;

  connection.query(sqlQuery, (error, resultQuery, fields) => {
    if (error) throw error;

    const date = new Date() / 1000;

    for (let i = 0; i < result.length; i++) {
      sqlQuery = `
        INSERT INTO shop_order (date, user_id, goods_id, goods_cost, goods_amount, total)
        VALUES (
          '${date}',
          '${resultQuery.insertId}',
          '${result[i]['id']}',
          '${result[i]['cost']}',
          '${data.key[result[i]['id']]}',
          '${data.key[result[i]['id']] * result[i]['cost']}'
        )
      `;

      connection.query(sqlQuery, (error, result, fields) => {
        if (error) throw error;
      });
    }
  });
}

function makeHash(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}
