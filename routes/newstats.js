var Document = require('../models/NewDocument');

function makeInitRules(req) {
    var initRules = [/*{
        $eq: ["$domain", req.user.domain]
    }, */{
        $gt: ["$subdomain", null]
    }];
    if (req.query.sDate) {
        initRules.push({
            $gte: ["$timings.receive", new Date(req.query.sDate)]
        });
    }
    if (req.query.eDate) {
        initRules.push({
            $lte: ["$timings.receive", new Date(req.query.eDate)]
        });
    }
    var rules = [{
        $redact: {
            $cond: {
                if: {
                    $and: initRules,
                },
                then: "$$KEEP",
                else: "$$PRUNE"
            }
        }
    }];

    if (req.query.field && req.query.accuracy) {
        rules.push(
            {$match: {"feedback.annotations": {$elemMatch: {label: req.query.field, correct: req.query.accuracy}}}}
        )
    }

    if (req.query.pageType && req.query.pageType !== 'All') {
        rules.push({$project:
            {
                _id: 0,
                id: 1,
                subdomain: 1,
                "feedback.rows": 1,
                "feedback.content": 1,
                "feedback.id": 1,
                "feedback.annotations": 0,
                path: 1,
                data: 1,
                timings: 1,
                domain: 1,
                "feedback.annotations": {
                    $filter: {
                        input: "$feedback.annotations",
                        as: "item",
                        cond: {$and: [{$eq: ["$$item.pagetype", req.query.pageType]}]}
                    }
                }
            }
        });
    }
    return rules;
}

function makeInitRulesForActivityPost(req) {
    var rules = [];
    console.log(req.body.docIds);
    for (var i in req.body.docIds) {
        rules.push({
            $eq: ["$id", req.body.docIds[i]]
        });
    }
    return [{
        $redact: {
            $cond: {
                if: {
                    $or: rules,
                },
                then: "$$KEEP",
                else: "$$PRUNE"
            }
        }
    }];
}

module.exports = function(app) {
    app.get('/newstats', function(req, res) {
        var rules = makeInitRules(req);
        rules.push(
            {$group: {_id: '',
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
            },
            {$project: {_id: false}}
        );
        Document.aggregate(rules).then(function(stats) {
            res.status(200).send(stats[0]);
        });
    });

    app.get('/avg-accuracy', function(req, res) {
        var rules = makeInitRules(req);
        rules.push(
            {$project: {_id: 0, id: 1, annotations: "$feedback.annotations", date: {$dateToString: {format: '%Y-%m-%d', date: '$timings.receive'}}}},
            {$unwind: "$annotations"}
        );
        if (req.query.fieldType !== 'average') {
            rules.push(
                {$match: {"annotations.label": {$eq: req.query.fieldType}}}
            );
        }
        rules.push(
            {$group: {_id: {date: "$date"}, data: {$push: "$annotations"}}},
            {$project: {_id: 0, data: 1, date: "$_id.date"}},
            {$sort : {"date"  : 1}}
        );
        Document.aggregate(rules).then(function(counts) {
            res.status(200).send(counts);
        });
    });

    app.get('/newaccuracy', function(req, res) {
        var rules = makeInitRules(req);
        rules.push(
            {$project: {annotations: "$feedback.annotations", _id: 0}},
            {$unwind: "$annotations"},
            {$group: {_id: {label: "$annotations.label", correct: "$annotations.correct"}, counts: {$sum: 1}}}
        );
        Document.aggregate(rules).then(function(counts) {
            res.status(200).send(counts);
        });
    });

    app.get('/newvolumes', function(req, res) {
        var rules = makeInitRules(req);
        rules.push(
            {$group: {_id: {date: {$dateToString: {format: '%Y-%m-%d', date: '$timings.receive'}}, subdomain: "$subdomain"}, count: {$sum: 1}, ids: {$push: "$id"}}},
            {$group: {_id: "$_id.subdomain", dates: {$push: {date: "$_id.date", count: "$count", ids: "$ids"}}}},
            {$project: {_id: false, dates: true, subdomain: "$_id"}}
        );
        Document.aggregate(rules).then(function(counts) {
            res.status(200).send(counts);
        });
    });

    app.get('/newtimings', function(req, res) {
        var rules = makeInitRules(req);
        rules.push(
            {$group:
                {
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
            },
            {$project: {_id: false}}
        );
        Document.aggregate(rules).then(function(counts) {
            res.status(200).send(counts[0]);
        });
    });

    app.get('/newstatistics', function(req, res) {
        var rules = makeInitRules(req);
        rules.push(
            {$project: {_id: 0, id: 1, annotations: "$feedback.annotations"}}
        );
        Document.aggregate(rules).then(function(counts) {
            res.status(200).send(counts);
        });
    });

    app.get('/newawareness', function (req, res){
        var rules = makeInitRules(req);
        rules.push(
            {$project: {_id: 0, id: 1, annotations: "$feedback.annotations"}},
            {$unwind: "$annotations"},
            {$match: {$and: [{"annotations.label": {$eq: req.query.fieldType}}, {"annotations.correct": {$ne: "A"}}]}}
        );
        Document.aggregate(rules).then(function(counts) {
            res.status(200).send(counts);
        });
    });

    app.get('/getfields', function (req, res){
        var rules  = makeInitRules(req);
        rules.push(
            {$project: {_id: 0, id: 1, annotations: "$feedback.annotations"}},
            {$unwind: "$annotations"},
            {$group: {_id: {label: "$annotations.label"}}},
            {$project: {_id:0, label: "$_id.label"}}
        );
        Document.aggregate(rules).then(function(counts) {
            res.status(200).send(counts);
        });
    });

    app.get('/getpagetypes', function (req, res){
        var rules  = makeInitRules(req);
        rules.push(
          {$project: {_id: 0, id: true, tags: "$feedback.content.tags"}},
          {$unwind: "$tags"},
          {$match: {$or : [{"tags.label" : { $type : "int" }}, {"tags.label" : { $type : "long" }}]}},
          {$group: {_id: {pagetype: "$tags.text"}}},
          {$group: {_id: '', data: {$push: "$_id.pagetype"}}},
          {$project: {_id: 0, data: true}}
        );
        Document.aggregate(rules).then(function(counts) {
            res.status(200).send(counts);
        });
    });

    app.get('/getdocids', function (req, res){
        var rules  = makeInitRules(req);
        rules.push(
            {$project: {_id: 0, id: 1}},
            {$group: {_id: '', data: {$push: "$id"}}},
            {$project: {_id: 0, data: true}}
        );
        Document.aggregate(rules).then(function(counts) {
            res.status(200).send(counts);
        });
    });

    app.get('/newactivity', function(req, res){
        var rules = makeInitRules(req);
        rules.push(
            {$project: {_id: false}}
        );
        Document.aggregate(rules).then(function(counts) {
            res.status(200).send(counts);
        });
    });

    app.post('/newactivity', function(req, res){
        var rules = makeInitRulesForActivityPost(req);
        rules.push(
            {$project: {_id: false}}
        );
        Document.aggregate(rules).then(function(counts) {
            res.status(200).send(counts);
        });
    });

    app.get('/autoField', function (req, res) {
        var rules = makeInitRules(req);
        rules.push(
            {$project: {annotations: "$feedback.annotations", _id: 0}},
            {$unwind: "$annotations"},
            {$group: {_id: {label: "$annotations.label"}, accuracy: {$push: {correct: "$annotations.correct", confidence: "$annotations.confidence"}}}}
        );
        Document.aggregate(rules).then(function(counts) {
            res.status(200).send(counts);
        });
    });
};