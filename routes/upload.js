var request = require('request');
var uploadCredentials = require('../uploadCredentials.json');

module.exports = function (app) {
  app.post('/upload', function(req, res) {
    if (uploadCredentials[req.user.domain] === undefined || uploadCredentials[req.user.domain]['upload'] === undefined || uploadCredentials[user.domain]['upload']['url'] === undefined) {
      res.sendStatus(403);
      return;
    }
    var options = {};
    if (uploadCredentials[req.user.domain]['upload']['user'] !== undefined && uploadCredentials[req.user.domain]['upload']['password'] !== undefined) {
      options['auth'] = {
        user: uploadCredentials[req.user.domain]['upload']['user'],
        pass: uploadCredentials[req.user.domain]['upload']['password']
      };
    }
    req.pipe(request.post(uploadCredentials[req.user.domain]['upload']['url'], options)).pipe(res);
  });
};
