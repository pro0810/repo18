var passport = require('passport');
var Account = require('../models/Account');
var uploadCredentials = require('../uploadCredentials.json');

function getUserResponse(user) {
  var responseUser = {
    name: user.username,
    domain: user.domain,
    roles: ['Admin', 'User'],
    anonymous: false,
  };
  if (uploadCredentials[user.domain] !== undefined && uploadCredentials[user.domain]['viewer'] !== undefined && uploadCredentials[user.domain]['viewer']['url'] !== undefined) {
    responseUser['baseUrl'] = uploadCredentials[user.domain]['viewer']['url'];
  }
  return responseUser;
}

module.exports = function(app) {

  app.post('/register', function(req, res) {
    Account.register(new Account({
      username: req.body.username
    }), req.body.password, function(err, account) {
      if (err) {
        return res.sendStatus(401);
      }

      passport.authenticate('local')(req, res, function() {
        res.send({
          "name": req.user.username,
          "domain": req.user.domain,
          "roles": ["Admin", "User"],
          "anonymous": false
        });
      });
    });
  });

  app.post('/login', passport.authenticate('local'), function(req, res) {
    res.send(getUserResponse(req.user));
  });

  app.post('/logout', function(req, res) {
    req.logOut();
    res.sendStatus(200);
  });

  app.get('/login', function(req, res) {
    if (!req.user) {
      res.send({
        "anonymous": true
      });
      return;
    }
    res.send(getUserResponse(req.user));
  });

};
