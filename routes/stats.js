var Document = require('../models/Document');

module.exports = function(app) {

  app.get('/stats', function(req, res) {
    Document.aggregate([{
      $redact: {
        $cond: {
          if: {
            $and: [{
              $gt: ["$timings.receive", new Date(new Date().getTime() - 86400000 * 30 * 12)]
            }, {
              $eq: ["$domain", req.user.domain]
            }, {
              $gt: ["$subdomain", null]
            }]
          },
          then: '$$KEEP',
          else: '$$PRUNE'
        }
      }
    }, {
      $group: {
        _id: '',
        data: {
          $avg: {
            $divide: ['$data.stats.found', '$data.stats.total']
          }
        },
        feedback: {
          $avg: {
            $divide: ['$feedback.stats.found', '$feedback.stats.total']
          }
        }
      }
    }, {
      $project: {
        _id: false
      }
    }]).then(stats => {
      res.status(200).send(stats[0]);
    });
  });

  app.get('/accuracy/:key', function(req, res) {
    Document.aggregate([{
      $redact: {
        $cond: {
          if: {
            $and: [{
              $gt: ["$timings.receive", new Date(new Date().getTime() - 86400000 * 30 * 12)]
            }, {
              $eq: ["$domain", req.user.domain]
            }, {
              $gt: ["$subdomain", null]
            }]
          },
          then: "$$KEEP",
          else: "$$PRUNE"
        }
      }
    }, {
      $group: {
        _id: {
          present: {
            $and: [{
              $gt: ["$data." + req.params.key, null]
            }, {
              $ne: ["$data." + req.params.key, ""]
            }]
          },
          feedback: {
            $and: [{
              $gt: ['$feedback', null]
            }, '$feedback.' + req.params.key + '.reviewed']
          },
          correct: '$feedback.' + req.params.key + '.correct'
        },
        count: {
          $sum: 1
        }
      }
    }, {
      $project: {
        _id: false,
        count: true,
        present: "$_id.present",
        feedback: "$_id.feedback",
        correct: "$_id.correct"
      }
    }]).then(counts => {
      res.status(200).send(counts);
    });
  });

  app.get('/volumes', function(req, res) {
    Document.aggregate([{
      $redact: {
        $cond: {
          if: {
            $and: [{
              $gt: ["$timings.receive", new Date(new Date().getTime() - 86400000 * 30 * 12)]
            }, {
              $eq: ["$domain", req.user.domain]
            }, {
              $gt: ["$subdomain", null]
            }]
          },
          then: "$$KEEP",
          else: "$$PRUNE"
        }
      }
    }, {
      $group: {
        _id: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timings.receive'
            }
          },
          subdomain: "$subdomain"
        },
        count: {
          $sum: 1
        }
      }
    }, {
      $group: {
        _id: "$_id.subdomain",
        dates: {
          $push: {
            date: "$_id.date",
            count: "$count"
          }
        }
      }
    }, {
      $project: {
        _id: false,
        dates: true,
        subdomain: "$_id"
      }
    }]).then(counts => {
      res.status(200).send(counts);
    });
  });

  app.get('/timings', function(req, res) {
    Document.aggregate([{
      $redact: {
        $cond: {
          if: {
            $and: [{
              $gt: ["$timings.receive", new Date(new Date().getTime() - 86400000 * 30 * 12)]
            }, {
              $eq: ["$domain", req.user.domain]
            }, {
              $gt: ["$subdomain", null]
            }]
          },
          then: '$$KEEP',
          else: '$$PRUNE'
        }
      }
    }, {
      $group: {
        _id: '',
        lead: {
          $avg: {
            $subtract: ['$timings.done', '$timings.receive']
          }
        },
        processing: {
          $avg: {
            $subtract: ['$timings.done', '$timings.start']
          }
        }
      }
    }, {
      $project: {
        _id: false
      }
    }]).then(timings => {
      res.status(200).send(timings[0]);
    });
  });
};