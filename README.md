# jtcluster - 简单封装cluster功能，主要用于保证worker进程退出时重新启动

##特性

- 在worker进程出错退出的时候，会自动重新一个新的worker，保证worker数的不变

- 可以发送启动命令重启所有的worker

- 定时的发送消息给所有worker，worker收到后回应，如果连续几次没回应，则认为该worker卡住，强制退出。（主要是为了避免worker内有代码写错，出现无限循环之类的情况，这个不要看作监控子进程的性能）


##Demo

```js
var tmpCluster = new JTCluster({
  handler : function(){
    // 获取所有worker的信息
    tmpCluster.getWorkersInfo(function(err, infos){
      console.dir(infos);
    })
    var express = require('express');
    var app = express();

    app.get('/', function(req, res){
      // 输出worker的jtProcessName
      res.send('success ' + process.env.jtProcessName);
    });
    app.get('/restartAll', function(req, res){
      // 重启所有worker
      JTCluster.restartAll();
      res.send('restarting ' + process.env.jtProcessName);
    });

    app.get('/running', function(req, res){
      res.send('running ' + process.env.jtProcessName);
      // 使worker陷入死循环，模拟worker无响应，master自动重启worker的情况
      while(true){

      }
    });
    app.listen(8080);
  },
  // 用于fork worker的传给worker的参数
  envs : [
    {
      jtProcessName : 'tiger'
    },
    {
      jtProcessName : 'cuttlefish'
    }
  ],
  error : console.error,
  log : console.log
});

```