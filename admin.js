module.exports = ( request, response, connection, next) => {
  if (request.cookies.id === undefined || request.cookies.hash === undefined) {
    response.redirect('/login');
    return;
  }

  connection.query(
    `SELECT * FROM user WHERE id=${request.cookies.id} AND hash="${request.cookies.hash}"`,
    (error, result, fields) => {
      if (error) throw error;

      if (result.length === 0) {
        response.redirect('/login');
      } else {
        next();
      }
    }
  );
};
