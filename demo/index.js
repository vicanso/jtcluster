(function() {
  var jtCluster, options;

  jtCluster = require('../index');

  options = {
    interval: 60 * 1000,
    timeout: 5 * 1000,
    failTimes: 5,
    slaveTotal: 3,
    restartOnError: true,
    slaveHandler: function() {
      var http, port, server;
      http = require('http');
      server = http.createServer(function(req, res) {
        if (req.url === '/restart') {
          process.send({
            cmd: 'jt_restart',
            timeout: 30000
          });
        }
        if (req.url === '/restartall') {
          process.send({
            cmd: 'jt_restartall',
            timeout: 30000
          });
        } else if (req.url === '/kill') {
          process.send({
            cmd: 'jt_kill'
          });
        } else if (req.url === '/fullrun') {
          setTimeout(function() {
            var j;
            while (true) {
              j = 0;
            }
          }, 100);
        } else if (req.url === '/error') {
          throw new Error('throw error');
        }
        res.writeHead(200);
        return res.end('hello world');
      });
      port = 10000;
      server.listen(port);
      return console.dir("listen on " + port);
    },
    error: function(err) {
      return console.dir(err.stack);
    },
    beforeRestart: function(cbf) {
      return setTimeout(function() {
        return cbf(null);
      }, 10000);
    }
  };

  jtCluster.start(options);

}).call(this);
