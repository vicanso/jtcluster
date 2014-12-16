var JTCluster = require('../index');
var tmpCluster = new JTCluster({
  handler : function(){
    
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
    setTimeout(function(){
      // 获取所有worker的信息
      tmpCluster.getWorkersInfo(function(err, infos){
        console.dir(infos);
      });
    }, 1000);
  },
  // 用于fork worker的传给worker的参数
  envs : [
    {
      jtProcessName : 'tiger'
    },
    {
      jtProcessName : 'cuttlefish'
    }
  ]
});