(function() {
  var jtCluster, options;

  jtCluster = require('../index');

  options = {
    slaveTotal: 1,
    slaveHandler: function() {
      var http, server;
      http = require('http');
      server = http.createServer(function(req, res) {
        if (req.url === '/restart') {
          process.send({
            cmd: 'restart'
          });
        } else if (req.url === '/forcerestart') {
          process.send({
            cmd: 'forcerestart'
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
