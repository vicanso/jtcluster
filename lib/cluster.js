'use strict';

var util = require('util');
var events = require('events');
var cluster = require('cluster');
var RESTART_ALL = 'JT_RESTART_ALL';
var PING = 'JT_PING';
var error = console.error;
var log = console.log;
var domain = require('domain');
var path = require('path');
var INFO_FILE_PATH = path.join(__dirname, '../workers.json');
var fs = require('fs');


var getDate = function(){
  var date = new Date();
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  if(month < 10){
    month = '0' + month;
  }
  var day = date.getDate();
  if(day < 10){
    day = '0' + day;
  }

  var hours = date.getHours();
  if(hours < 10){
    hours = '0' + hours;
  }

  var minutes = date.getMinutes();
  if(minutes < 10){
    minutes = '0' + minutes;
  }

  var seconds = date.getSeconds();
  if(seconds < 10){
    seconds = '0' + seconds;
  }

  return '' + year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
};

/**
 * [JTCluster 构建函数]
 * @param {[type]} options [description]
 */
var JTCluster = function(options){
  var self = this;
  if(options.error){
    error = options.error;
  }
  if(options.log){
    log = options.log;
  }
  events.EventEmitter.call(self);
  self.options = {
    workerInfos : []
  };
  if(cluster.isMaster){
    var envs = options.envs;
    //为每个worker配置不同的env
    envs.forEach(function(env){
      var name = env.jtProcessName;
      var worker = cluster.fork(env);
      self.options.workerInfos.push({
        env : env,
        name : name,
        pid : worker.process.pid,
        // ping的次数，在调用ping的时候加1，在接收到worker返回的ping时减1
        ping : 0,
        startTimes : []
      });
    });
    self._initMasterEvent();
  }else{
    JTCluster.name = self.name = process.env.jtProcessName;
    process.on('message', function(msg){
      // worker收到PING消息时，返回消息给master（用于防止worker是否出问题）
      if(msg == PING){
        process.send(PING);
      }
    });
    var d = domain.create();
    d.on('error', function(err){
      error('Caught error:' + err.message + ', stack:' + err.stack);
    });
    setImmediate(function(){
      d.run(options.handler);
    });
    
  }
};



util.inherits(JTCluster, events.EventEmitter);
var fn = JTCluster.prototype;

/**
 * [restartAll 重启所有woker]
 * @return {[type]} [description]
 */
JTCluster.restartAll = fn.restartAll = function(){
  if(cluster.isMaster){
    Object.keys(cluster.workers).forEach(function(id){
      var worker = cluster.workers[id];
      restart(worker);
    });
  }else{
    process.send(RESTART_ALL);
  }
};

/**
 * [restart 重启worker]
 * @param  {[type]} worker [description]
 * @return {[type]}        [description]
 */
var restart = function(worker){
  if(worker.suicide){
    return;
  }
  worker.disconnect();
  var timer = setTimeout(function(){
    worker.kill(0);
  }, 5000);
  worker.once('disconnect', function(){
    clearTimeout(timer);
  });
};

/**
 * [_initMasterEvent 初始化master的事件]
 * @return {[type]} [description]
 */
fn._initMasterEvent = function(){
  var self = this;
  var workersInfos = self.options.workerInfos;

  var find = function(pid){
    var result = null;
    workersInfos.forEach(function(info){
      if(!result && info.pid === pid){
        result = info;
      }
    });
    return result;
  };

  cluster.on('exit', function(worker, code){
    var workerInfos = find(worker.process.pid);
    //当workder退出，且code不为0（调用restartAll时重启不记录为error），记录error信息
    if(code){
      error('the preocess ' + workerInfos.name + ' exit pid:' + workerInfos.pid + ' code:' + code);
    }
    //在退出之后的1秒重新fork一个新的worker
    setTimeout(function(){
      var worker = cluster.fork(workerInfos.env);
      workerInfos.ping = 0;
      workerInfos.pid = worker.process.pid;
    }, 1000);
  });

  cluster.on('online', function(worker){
    var info = find(worker.process.pid);
    log('the process ' + info.name + ' is online pid:' + worker.process.pid);
    info.startTimes.push(getDate());
    worker.on('message', function(msg){
      if(msg === RESTART_ALL){
        JTCluster.restartAll();
      }else if(msg == PING){
        var workersInfos = find(worker.process.pid);
        workersInfos.ping = 0;
      }
    });
  });
  cluster.on('disconnect', function(worker){
    log('disconnet:' + worker.process.pid);
  });

  //定时ping worker
  var timer = setInterval(function(){
    Object.keys(cluster.workers).forEach(function(id){
      var worker = cluster.workers[id];
      var workersInfos = find(worker.process.pid);
      workersInfos.ping++;
      if(workersInfos.ping >= 3){
        error(workersInfos.name + ' is too busy');
        restart(worker);
      }
      worker.send(PING);
    });
    fs.writeFile(INFO_FILE_PATH, JSON.stringify(workersInfos, null, 2));
  }, 10000);
  timer.unref();
};

module.exports = JTCluster;


var tmpCluster = new JTCluster({
  handler : function(){
    console.dir(tmpCluster.name);
    var express = require('express');
    var app = express();

    app.get('/', function(req, res){
      res.send('success ' + process.env.jtProcessName);
    });
    app.get('/restartAll', function(req, res){
      JTCluster.restartAll();
      res.send('restarting ' + process.env.jtProcessName);
    });
    app.get('/running', function(req, res){
      res.send('running ' + process.env.jtProcessName);
      while(true){

      }
    });
    app.listen(8080);
  },
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