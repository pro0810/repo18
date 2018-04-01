var Document = require('../models/NewDocument');

function makeInitRules(req) {
    var rules = [/*{
        $eq: ["$domain", req.user.domain]
    }, */{
        $gt: ["$subdomain", null]
    }];
    if (req.query.sDate) {
        rules.push({
            $gte: ["$timings.receive", new Date(req.query.sDate)]
        });
    }
    if (req.query.eDate) {
        rules.push({
            $lte: ["$timings.receive", new Date(req.query.eDate)]
        });
    }
    return rules;
}

function makeInitRulesForPost(req) {
    var rules = [];
    console.log(req.body.docIds);
    for (var i in req.body.docIds) {
        rules.push({
            $eq: ["$id", req.body.docIds[i]]
        });
    }
    return rules;
}

module.exports = function(app) {
    function filterByDocType(docType, res) {
        if (docType && docType != 'All') {
            app.get()
        } else {
            return res;
        }
    }


    app.get('/newstats', function(req, res) {
      var rules = makeInitRules(req);
    Document.aggregate([{
      $redact: {
        $cond: {
          if: {
            $and: rules,
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

    app.get('/newaccuracy', function(req, res) {
    var rules = makeInitRules(req);
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
    },
    {$project: {annotations: "$feedback.annotations", _id: 0}},
    {$unwind: "$annotations"},
    {$group: {_id: {label: "$annotations.label", correct: "$annotations.correct"}, counts: {$sum: 1}}}
    ]).then(function(counts) {
      res.status(200).send(counts);
    });
    });

    app.get('/newvolumes', function(req, res) {
      var rules = makeInitRules(req);
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
    },
        {$group: {_id: {date: {$dateToString: {format: '%Y-%m-%d', date: '$timings.receive'}}, subdomain: "$subdomain"}, count: {$sum: 1}, ids: {$push: "$id"}}},
        {$group: {_id: "$_id.subdomain", dates: {$push: {date: "$_id.date", count: "$count", ids: "$ids"}}}},
        {$project: {_id: false, dates: true, subdomain: "$_id"}}
    ]).then(function(counts) {
      res.status(200).send(counts);
    });
    });

    app.get('/newtimings', function(req, res) {
      var rules = makeInitRules(req);
    Document.aggregate([{
      $redact: {
        $cond: {
          if: {
            $and: rules,
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
    }]).then(function(counts) {
      res.status(200).send(counts[0]);
    });
    });

    app.get('/newstatistics', function(req, res) {
      var rules = makeInitRules(req);
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
        },
        {$project: {_id: 0, id: 1, annotations: "$feedback.annotations"}},
        ]).then(function(counts) {
            res.status(200).send(counts);
    });
    });

    app.get('/newawareness', function (req, res){
    var rules = makeInitRules(req);
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
    },
    {$project: {_id: 0, id: 1, annotations: "$feedback.annotations"}},
    {$unwind: "$annotations"},
    {$match: {$and: [{"annotations.label": {$eq: req.query.fieldType}}, {"annotations.correct": {$ne: "A"}}]}}
    ]).then(function(counts) {
        res.status(200).send(counts);
    });
    });

    app.get('/getfields', function (req, res){
      var rules  = makeInitRules(req);
      Document.aggregate([{
          $redact: {
              $cond: {
                  if: {
                      $and: rules
                  },
                  then: "$$KEEP",
                  else: "$$PRUNE"
              }
          }
      },
          {$project: {_id: 0, id: 1, annotations: "$feedback.annotations"}},
          {$unwind: "$annotations"},
          {$group: {_id: {label: "$annotations.label"}}},
          {$project: {_id:0, label: "$_id.label"}}
      ]).then(function(counts) {
          counts = filterByDocType(req.query.docType, counts);
          res.status(200).send(counts);
    });
    });

    app.get('/getdoctypes', function (req, res){
      var rules  = makeInitRules(req);
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
        },
            {$project: {_id: 0, id: true, tags: "$feedback.content.tags"}},
            {$unwind: "$tags"},
            {$match: {$or : [{"tags.label" : { $type : "int" }}, {"tags.label" : { $type : "long" }}]}},
            {$group: {_id: {doctype: "$tags.text"}}},
            {$group: {_id: '', data: {$push: "$_id.doctype"}}},
            {$project: {_id: 0, data: true}}
        ]).then(function(counts) {
            res.status(200).send(counts);
      });
    });

    app.get('/getdocids', function (req, res){
        var rules  = makeInitRules(req);
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
        },
            {$project: {_id: 0, id: 1}},
            {$group: {_id: '', data: {$push: "$id"}}},
            {$project: {_id: 0, data: true}}
        ]).then(function(counts) {
            res.status(200).send(counts);
        });
    });

    app.get('/newactivity', function(req, res){
      var rules = makeInitRules(req);
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
      }, {
          $project: {
              _id: false
          }
      }
      ]).then(function(counts) {
          res.status(200).send(counts);
    });
    });

    app.post('/newactivity', function(req, res){
        var rules = makeInitRulesForPost(req);
        Document.aggregate([{
            $redact: {
                $cond: {
                    if: {
                        $or: rules,
                    },
                    then: "$$KEEP",
                    else: "$$PRUNE"
                }
            }
        }, {
            $project: {
                _id: false
            }
        }
        ]).then(function(counts) {
            res.status(200).send(counts);
    });
    });

    app.get('/autoAccuracy', function (req, res) {
      var rules = makeInitRules(req);
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
      },
          {$project: {annotations: "$feedback.annotations", _id: 0}},
          {$unwind: "$annotations"},
          {$group: {_id: {label: "$annotations.label"}, accuracy: {$push: {correct: "$annotations.correct", confidence: "$annotations.confidence"}}}}
      ]).then(function(counts) {
          res.status(200).send(counts);
    });
    });

};