var express = require('express');
var router = express.Router();

var basex = require('basex');
var client = new basex.Session("127.0.0.1", 1984, "admin", "admin");
client.execute("OPEN Colenso");

/* GET home page. */
router.get('/', function(req, res) {
    res.render('index', { title: 'The Colenso TEI Database' });
});

router.get('/browse', function(req, res) {
    var query = "XQUERY declare default element namespace 'http://www.tei-c.org/ns/1.0';" +
        "for $n in (//title)\n" +
        "where db:path($n) contains text '" + req.query.type + "'" +
        "return concat('<p class=\"browse\">', $n, " +
        "' (<a href=\"/file?filename=', db:path($n), '\" class=\"browse\">', db:path($n), '</a>)</p>')";

    client.execute(query,
        function (error, result) {
            if(error) {
                console.error(error);
            }
            else {
                var selected = 0;
                if (req.query.type == "private_letters") selected = 0;
                if (req.query.type == "newspaper_letters") selected = 1;
                if (req.query.type == "diary") selected = 2;
                if (req.query.type == "publications") selected = 3;
                if (req.query.type == "judgements") selected = 4;

                res.render('browse', { title: 'The Colenso TEI Database', results: result.result, selected: selected });
            }
        }
    );
});

router.get('/search', function(req, res) {
    var query = "XQUERY declare default element namespace 'http://www.tei-c.org/ns/1.0';" +
        "for $n in (//title[. contains text '" + req.query.searchString + "'])\n" +
        "return concat('<a href=\"/file?filename=', db:path($n), '\" class=\"searchResult\">', $n, '</a>'," +
        "'<p class=\"searchResult\">', db:path($n), '</p>')";

    client.execute(query,
        function (error, result) {
            if(error) {
                console.error(error);
            }
            else {
                var nResults = (result.result.match(/<\/a>/g) || []).length;
                res.render('search', { title: 'The Colenso TEI Database', results: result.result, nResults: nResults });
            }
        }
    );
});

router.get('/file', function(req, res) {
    var query = "XQUERY doc('Colenso/" + req.query.filename + "')";

    client.execute(query,
        function (error, result) {
            if(error) {
                console.error(error);
            }
            else {
                if (!result.result) {
                    result.result = "File not found.";
                }

                var title = result.result.match(/<title>[\s\S]*?<\/title>/)[0];
                title = title.replace("<title>", "");
                title = title.replace("</title>", "");

                var person = result.result.match(/<author>[\s\S]*?<\/author>/)[0];
                person = person.replace("<name", "<a");
                person = person.replace("key=", "href=");
                person = person.replace("</name>", "</a>");

                var date = result.result.match(/<date[\s\S]*?<\/date>/)[0];
                date = date.replace("<date", "<b");
                date = date.replace("</date>", "</b>");

                var source = result.result.match(/<sourceDesc>[\s\S]*?<\/sourceDesc>/)[0];
                source = source.replace("<sourceDesc>", "");
                source = source.replace("</sourceDesc>", "");

                var text =  result.result.match(/<text>[\s\S]*?<\/text>/)[0];
                text = text.replace("<text>", "");
                text = text.replace("</text>", "");

                var rawXML = "<a href='rawXML?file=" + req.query.filename + "'>View raw XML</a>";

                var messageData = {title: title, person: person, date: date, source: source, text: text, rawXML: rawXML};
                res.render('file', { title: 'The Colenso TEI Database', data: messageData });
            }
        }
    );
});

router.get('/rawXML', function(req, res) {
    var query = "XQUERY doc('Colenso/" + req.query.file + "')";

    client.execute(query,
        function (error, result) {
            if(error) {
                console.error(error);
            }
            else {
                res.render('xml', { title: 'The Colenso TEI Database', data: result.result });
            }
        }
    );
});

module.exports = router;
