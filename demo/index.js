(function() {
  var jtCluster, options;

  jtCluster = require('../index');

  options = {
    slaveHandler: function() {
      var http, server;
      http = require('http');
      server = http.createServer(function(req, res) {
        console.dir(req.url);
        if (req.url === '/restart') {
          process.send({
            cmd: 'restart'
          });
        }
        res.writeHead(200);
        return res.end('hello world');
      });
      return server.listen(8000);
    },
    error: function(err) {
      return console.dir(err);
    },
    beforeRestart: function(cbf) {
      return setTimeout(function() {
        return cbf(null);
      }, 10000);
    }
  };

  jtCluster.start(options);

}).call(this);
