var Document = require('../models/FieldThreshold');
var fs = require('fs');

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

    if (req.query.pageType && req.query.pageType != 'All') {
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

function makeInitRulesForPost(req) {
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
    app.post('/fieldsThresholds', function(req, res){
        var fieldThresholds =  req.body.fieldsThresholds;
        console.log(fieldThresholds);
        try {
            fs.writeFile('fieldThresholds.json', JSON.stringify(fieldThresholds), 'utf-8', function(err) {
                    if (err) {
                        console.log("error on writing fieldsThresholds file: " + err);
                    }
                });
        } catch (err) {
            console.log("error on writing fieldsThresholds file: " + err);
        }

        Document.update(
            {},
            {data: fieldThresholds},
            {
                upsert: true,
                overwrite: true,
            },
            function() {
                res.status(200).send('success');
            }
        );
    });

    app.get('/fieldsThresholds', function (req, res) {
        Document.find({}, function(err, counts) {
            if (! err) {
                console.log(err);
                console.log(counts);
                res.status(200).send(counts);
            }
        });
    });
};

