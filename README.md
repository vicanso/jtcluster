# jtcluster - 简单封装cluster功能，主要用于保证worker进程退出时重新启动

##特性

- 在worker进程出错退出的时候，会自动重新一个新的worker，保证worker数的不变
- 可以发送启动命令重启所有的worker(通过disconnect)，保证当前所处理的请求完成之后才进行重启，在timeout之后还未退出强行退出
- 可以强制启动所有的worker(通过kill实现)
- 定时的发送消息给所有worker，worker收到后回应，如果连续几次没回应，则认为该worker卡住，强制退出。（主要是为了避免worker内有代码写错，出现无限循环之类的情况，这个不要看作监控子进程的性能）


##Demo

```js
(function() {
  var jtCluster, options;

  var JTCluster = require('jtcluster');

  options = {
    // 检测的时间间隔
    interval: 60 * 1000,
    // worker检测的超时值
    timeout: 5 * 1000,
    // 连续失败多少次后重启
    failTimes: 5,
    // 子进程的个数
    slaveTotal: 3,
    // 子进程的执行函数
    slaveHandler: function() {
      var http, port, server;
      http = require('http');
      server = http.createServer(function(req, res) {
        if (req.url === '/restart') {
          process.send({
            cmd: 'restart',
            timeout : '30000'
          });
        } else if (req.url === '/forcerestart') {
          process.send({
            cmd: 'forcerestart'
          });
        } else if (req.url === '/fullrun') {
          setTimeout(function() {
            var j;
            while (true) {
              j = 0;
            }
          }, 100);
        }
        res.writeHead(200);
        return res.end('hello world');
      });
      port = 8080;
      server.listen(port);
      return console.dir("listen on " + port);
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
  jtCluster = new JTCluster();
  jtCluster.start(options);

}).call(this);

```