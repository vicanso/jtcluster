# jtcluster - 简单封装cluster功能，主要用于保证worker进程退出时重新启动

##特性

- 在worker进程出错退出的时候，会自动重新一个新的worker，保证worker数的不变
- 可以发送启动命令重启所有的worker(通过disconnect)，保证当前所处理的请求完成之后才进行重启
- 可以强制启动所有的worker(通过kill实现)


##Demo

```js
(function() {
  var jtCluster, options;

  jtCluster = require('jtcluster');

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

```