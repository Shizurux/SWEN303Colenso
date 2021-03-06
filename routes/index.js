var express = require('express');
var router = express.Router();
var multer = require('multer');

var basex = require('basex');
var client = new basex.Session("127.0.0.1", 1984, "admin", "admin");
client.execute("OPEN Colenso");

var fs = require('fs');

var searchHistory = [];
var searchHistoryCounts = {};
var searchHistoryType = {};

var lastSearch = "";

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
    var search = req.query.searchString;

    if (req.query.searchString) {
        if (searchHistoryCounts[req.query.searchString]) {
            searchHistoryCounts[req.query.searchString] += 1;
        }
        else {
            searchHistory.push(req.query.searchString);
            searchHistoryType[req.query.searchString] = "normal";
            searchHistoryCounts[req.query.searchString] = 1;
        }

        var searchTokens = [];

        var currentWord = "";
        for (var i = 0; i < search.length; i++) {
            if (search.charAt(i) == '+') {
                searchTokens.push(currentWord);
                currentWord = "";
                searchTokens.push('+');
            }
            else if (search.charAt(i) == '|') {
                searchTokens.push(currentWord);
                currentWord = "";
                searchTokens.push('|');
            }
            else if (search.charAt(i) == '-') {
                searchTokens.push(currentWord);
                currentWord = "-";
            }
            else {
                currentWord += search.charAt(i);
            }
        }
        searchTokens.push(currentWord);

        for (var i = 0; i < searchTokens.length; i++) {
            searchTokens[i] = searchTokens[i].trim();
            if (searchTokens[i] == '+') {
                searchTokens[i] = 'and';
            }
            else if (searchTokens[i] == '|') {
                searchTokens[i] = 'or';
            }
            else {
                if (searchTokens[i][0] == '-') {
                    searchTokens[i] = "and not(. contains text '" + searchTokens[i].substr(1, searchTokens[i].length) + "')";
                }
                else {
                    searchTokens[i] = ". contains text '" + searchTokens[i] + "'";
                }
            }
        }

        search = "";
        for (var i = 0; i < searchTokens.length; i++) {
            search += searchTokens[i] + " ";
        }
    }

    var query = "XQUERY declare default element namespace 'http://www.tei-c.org/ns/1.0';" +
        "for $n in (//TEI[" + search + "])\n" +
        "return concat('<div class=\"well\"><a href=\"/file?filename=', db:path($n), '\" class=\"searchResult\">', $n//title, '</a>'," +
        "'<p class=\"searchResult\">', db:path($n), ' (<b>', string(string-length($n) div 1000), ' kB</b>) <a href=\"/rawXML?file=', db:path($n), '\">View/edit raw XML</a></p></div>')";

    client.execute(query,
        function (error, result) {
            if(error) {
                console.error(error);
            }
            else {
                searchHistory2 = [];
                for (var i = 0; i < searchHistory.length; i++) {
                    var str = "";

                    if (searchHistoryType[searchHistory[i]] == "normal") {
                        str += " <a href='/search?searchString=" + searchHistory[i] + "'>" + searchHistory[i] + "</a>";
                    }
                    else {
                        str += " <a href='/searchQuery?searchString=" + searchHistory[i] + "'>" + searchHistory[i] + "</a>";
                    }

                    str += ": ";
                    str += searchHistoryCounts[searchHistory[i]].toString();

                    searchHistory2.push(str);
                }

                lastSearch = result.result;

                if (req.query.searchString) {
                    var nResults = (result.result.match(/<\/div>/g) || []).length;
                    res.render('search', {
                        title: 'The Colenso TEI Database',
                        results: result.result,
                        nResults: nResults,
                        customQuery: false,
                        originalSearch: search,
                        searchHistory: searchHistory2
                    });
                }
                else {
                    res.render('search', {
                        title: 'The Colenso TEI Database',
                        results: "",
                        nResults: 0,
                        customQuery: false,
                        originalSearch: search,
                        searchHistory: searchHistory2
                    });
                }
            }
        }
    );
});

router.get('/searchQuery', function(req, res) {
    if (searchHistoryCounts[req.query.searchString]) {
        searchHistoryCounts[req.query.searchString] += 1;
    }
    else {
        searchHistory.push(req.query.searchString);
        searchHistoryType[req.query.searchString] = "xquery";
        searchHistoryCounts[req.query.searchString] = 1;
    }

    var query = "XQUERY declare default element namespace 'http://www.tei-c.org/ns/1.0';" +
        "for $n in (" + req.query.searchString + ")\n" +
        "return concat('<div class=\"well\"><a href=\"/file?filename=', db:path($n), '\" class=\"searchResult\">', $n, '</a>'," +
        "'<p class=\"searchResult\">', db:path($n), ' (<b>', string(string-length($n) div 1000), ' kB</b>) <a href=\"/rawXML?file=', db:path($n), '\">View/edit raw XML</a></p></div>')";

    lastSearch = query;

    client.execute(query,
        function (error, result) {
            if(error) {
                console.error(error);
            }
            else {
                searchHistory2 = [];
                for (var i = 0; i < searchHistory.length; i++) {
                    var str = "";

                    if (searchHistoryType[searchHistory[i]] == "normal") {
                        str += " <a href='/search?searchString=" + searchHistory[i] + "'>" + searchHistory[i] + "</a>";
                    }
                    else {
                        str += " <a href='/searchQuery?searchString=" + searchHistory[i] + "'>" + searchHistory[i] + "</a>";
                    }

                    str += ": ";
                    str += searchHistoryCounts[searchHistory[i]].toString();

                    searchHistory2.push(str);
                }

                var nResults = (result.result.match(/<\/div>/g) || []).length;
                res.render('search', {
                    title: 'The Colenso TEI Database',
                    results: result.result,
                    nResults: nResults,
                    customQuery: true,
                    originalSearch: req.query.searchString,
                    searchHistory: searchHistory2
                });
            }
        }
    );
});

router.get('/searchResults', function(req, res) {
    searchHistory2 = [];
    for (var i = 0; i < searchHistory.length; i++) {
        var str = "";

        if (searchHistoryType[searchHistory[i]] == "normal") {
            str += " <a href='/search?searchString=" + searchHistory[i] + "'>" + searchHistory[i] + "</a>";
        }
        else {
            str += " <a href='/searchQuery?searchString=" + searchHistory[i] + "'>" + searchHistory[i] + "</a>";
        }

        str += ": ";
        str += searchHistoryCounts[searchHistory[i]].toString();

        searchHistory2.push(str);
    }

    var returnStr = "";
    var resultsTokens = lastSearch.split("</div>");
    for (var i = 0; i < resultsTokens.length; i++) {
        resultsTokens[i] += "</div>";
    }

    for (var i = 0; i < resultsTokens.length; i++) {
        if (resultsTokens[i].toLowerCase().indexOf(req.query.searchString.toLowerCase()) >= 0) {
            returnStr += resultsTokens[i];
        }
    }

    lastSearch = returnStr;
    var nResults = (returnStr.match(/<\/div>/g) || []).length;

    res.render('search', {
        title: 'The Colenso TEI Database',
        results: returnStr,
        nResults: nResults,
        customQuery: false,
        originalSearch: req.query.searchString,
        searchHistory: searchHistory2
    });
});

router.get('/downloadXML', function(req, res) {
    var query = "XQUERY declare default element namespace 'http://www.tei-c.org/ns/1.0';" +
        "for $n in (//TEI[" + req.query.xml + "])\n" +
        "return doc(concat('Colenso/', db:path($n)))";

    client.execute(query,
        function (error, result) {
            if(error) {
                console.error(error);
            }
            else {
                var nResults = (result.result.match(/<\/a>/g) || []).length;
                res.render('xml', { title: 'The Colenso TEI Database', data: result.result, xmlFilename: "customXMLsearch.xml", showSaveBtn: false });
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

                var person = "";
                if (result.result.match(/<author>[\s\S]*?<\/author>/)) {
                    person = result.result.match(/<author>[\s\S]*?<\/author>/)[0];
                    person = person.replace("<name", "<a");
                    person = person.replace("key=", "href=");
                    person = person.replace("</name>", "</a>");
                }
                else {
                    person = "Unknown";
                }

                var date = result.result.match(/<date[\s\S]*?<\/date>/)[0];
                date = date.replace("<date", "<b");
                date = date.replace("</date>", "</b>");

                var source = result.result.match(/<sourceDesc>[\s\S]*?<\/sourceDesc>/)[0];
                source = source.replace("<sourceDesc>", "");
                source = source.replace("</sourceDesc>", "");

                var text =  result.result.match(/<text>[\s\S]*?<\/text>/)[0];
                text = text.replace("<text>", "");
                text = text.replace("</text>", "");

                text = text.split('type="entry"').join('class="well"');

                text = text.split('rend="bold"').join('style="font-weight:bold;"');
                text = text.split('rend="center"').join('style="text-align:center;"');

                var rawXML = "<a href='rawXML?file=" + req.query.filename + "'>View/edit raw XML</a>";

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
            if (error) {
                console.error(error);
            }
            else {
                res.render('xml', {
                    title: 'The Colenso TEI Database',
                    xmlPath: req.query.file,
                    data: result.result,
                    xmlFilename: req.query.file.substring(req.query.file.lastIndexOf('/') + 1),
                    showSaveBtn: true
                });
            }
        }
    );
});

router.get('/saveXML', function(req, res) {
    var query = "REPLACE " + req.query.file + " " + unescape(req.query.data);

    client.execute(query,
        function (error, result) {
            if (error) {
                res.render('xml', {
                    title: 'The Colenso TEI Database',
                    xmlPath: req.query.file,
                    data: unescape(req.query.data),
                    xmlFilename: req.query.file.substring(req.query.file.lastIndexOf('/') + 1),
                    showSaveBtn: true,
                    error: error
                });
            }
            else {
                client.execute("EXPORT Colenso_TEIs/",
                    function (error, result) {
                        if (error) {
                            console.error(error);
                        }
                        else {
                            var query = "XQUERY doc('Colenso/" + req.query.file + "')";

                            client.execute(query,
                                function (error, result) {
                                    if (error) {
                                        console.error(error);
                                    }
                                    else {
                                        res.render('xml', {
                                            title: 'The Colenso TEI Database',
                                            xmlPath: req.query.file,
                                            data: result.result,
                                            xmlFilename: req.query.file.substring(req.query.file.lastIndexOf('/') + 1),
                                            showSaveBtn: true
                                        });
                                    }
                                }
                            );
                        }
                    }
                );
            }
        }
    );
});

var fileNameGlobal = "";
var directoryGlobal = "";

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, '../Colenso_TEIs/');
    },
    filename: function (req, file, callback) {
        directoryGlobal = req.body.directory;

        var extension = file.originalname.substring(file.originalname.lastIndexOf('.')+1);
        if (extension != "xml") {
            callback("Invalid file type (only .xml is allowed).", null);
        }
        else {
            fileNameGlobal = file.originalname;
            callback(null, directoryGlobal + file.originalname);
        }
    }
});

var upload = multer({ storage : storage}).single('xmlFile');

router.post('/add', function(req, res) {
    upload(req, res, function(err) {
        if(err) {
            res.render('add', { title: 'The Colenso TEI Database', message: err })
        }
        else {
            client.execute("ADD TO " + directoryGlobal + fileNameGlobal + " Colenso_TEIs/" + directoryGlobal + fileNameGlobal, function(err, res) {
                if (err) {
                    console.log(err);
                }
                else {
                    console.log(res);
                }
            });
            res.render('add', { title: 'The Colenso TEI Database', message: "File successfully uploaded." })
        }
    });
});

router.get('/add', function(req, res) {
    res.render('add', { title: 'The Colenso TEI Database', message: ""  });
});

module.exports = router;
