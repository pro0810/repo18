var Document = require('../models/Document');

module.exports = function(app) {

  app.get('/activity', function(req, res) {
    Document.redactForUser(req.user, function(err, documents) {
      res.status(200).send(documents);
    });
  });

  app.get('/activity/:key/:state', function(req, res) {
    var rules = [/*{
      $gt: ["$timings.receive", new Date(new Date().getTime() - 86400000 * 30)]
    }, */{
      $eq: ["$domain", req.user.domain]
    }, {
      $gt: ["$subdomain", null]
    }];
    switch (req.params.state) {
      case 'missing':
        rules.push({
          $or: [{
            $lt: ["$data." + req.params.key, null]
          }, {
            $eq: ["$data." + req.params.key, ""]
          }]
        });
        break;
      case 'present':
        rules.push({
          $gt: ["$data." + req.params.key, null]
        });
        rules.push({
          $ne: ["$data." + req.params.key, ""]
        });
        rules.push({
          $lt: ["$feedback." + req.params.key, null]
        });
        break;
      case 'correct':
        rules.push({
          $gt: ["$data." + req.params.key, null]
        });
        rules.push({
          $ne: ["$data." + req.params.key, ""]
        });
        rules.push({
          $eq: ["$data." + req.params.key, "$feedback." + req.params.key]
        })
        break;
      case 'incorrect':
        rules.push({
          $gt: ["$data." + req.params.key, null]
        });
        rules.push({
          $ne: ["$data." + req.params.key, ""]
        });
        rules.push({
          $gt: ["$feedback." + req.params.key, null]
        });
        rules.push({
          $ne: ["$data." + req.params.key, "$feedback." + req.params.key]
        })
        break;
      default:
        res.status(404).send();
    }


    Document.aggregate([{
      $redact: {
        $cond: {
          if: {
            $and: rules,
          },
          then: "$$KEEP",
          else: "$$PRUNE"
        }
      }
    }]).then(documents => {
      res.status(200).send(documents);
    });
  });
};