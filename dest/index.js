(function() {
  var CHECK_MSG, CHECK_TIMES, HEALTHY_MSG, JTCluster, SET_JT_PID_MSG, cluster, events, noop,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  cluster = require('cluster');

  events = require('events');

  CHECK_TIMES = {};

  CHECK_MSG = 'WORKER_CHECK';

  HEALTHY_MSG = 'I AM HEALTHY';

  SET_JT_PID_MSG = 'SET JT PID';

  noop = function() {};

  JTCluster = (function(_super) {
    __extends(JTCluster, _super);


    /**
     * constructor 构造函数
     * @param  {[type]} @options [description]
     * @return {[type]}          [description]
     */

    function JTCluster(options) {
      var childProcess, i, total, _i;
      this.options = options != null ? options : {};
      if (cluster.isMaster) {
        if (options.interval == null) {
          options.interval = 10 * 1000;
        }
        if (options.timeout == null) {
          options.timeout = 10 * 1000;
        }
        if (options.failTimes == null) {
          options.failTimes = 5;
        }
        if (options.masterHandler) {
          options.masterHandler();
        }
        total = options.slaveTotal || require('os').cpus().length;
        if (total < 1) {
          total = 1;
        }
        for (i = _i = 0; 0 <= total ? _i < total : _i > total; i = 0 <= total ? ++_i : --_i) {
          childProcess = cluster.fork();
          childProcess._jtPid = i;
        }
        this._initEvent();
        Object.keys(cluster.workers).forEach((function(_this) {
          return function(id) {
            var worker;
            worker = cluster.workers[id];
            return worker.send({
              msg: SET_JT_PID_MSG,
              _jtPid: worker._jtPid
            });
          };
        })(this));
      } else {
        this._slaveHandler();
      }
    }


    /**
     * restartAll 重启所有worker
     * @return {[type]} [description]
     */

    JTCluster.prototype.restartAll = function() {
      return process.send({
        cmd: 'jt_restartall',
        timeout: 30000
      });
    };


    /**
     * _slaveHandler slave的执行函数
     * @return {[type]} [description]
     */

    JTCluster.prototype._slaveHandler = function() {
      var d, domain, restartOnError, slaveHandler;
      restartOnError = this.options.restartOnError;
      slaveHandler = this.options.slaveHandler;
      domain = require('domain');
      if (slaveHandler) {
        d = domain.create();
        d.on('error', (function(_this) {
          return function(err) {
            var params;
            params = {
              pid: process.pid,
              _jtPid: process._jtPid,
              err: err.toString(),
              stack: err.stack
            };
            _this.emit('log', {
              category: 'uncaughtException',
              params: JSON.stringify(params),
              date: new Date()
            });
            if (restartOnError) {
              setTimeout(function() {
                return process.exit(1);
              }, 30000);
              return cluster.worker.disconnect();
            }
          };
        })(this));
        d.run(function() {
          return slaveHandler();
        });
      }
      process.on('message', function(msg) {
        if (msg === CHECK_MSG) {
          process.send(HEALTHY_MSG);
        } else if ((msg != null ? msg.msg : void 0) === SET_JT_PID_MSG) {
          process._jtPid = msg._jtPid;
        }
      });
      return this;
    };


    /**
     * _msgHandler 消息处理
     * @param  {[type]} msg [description]
     * @param  {[type]} pid [description]
     * @return {[type]}     [description]
     */

    JTCluster.prototype._msgHandler = function(msg, pid) {
      var cmd, func;
      if (msg === HEALTHY_MSG) {
        if (Date.now() - CHECK_TIMES[pid].now > this.options.timeout) {
          CHECK_TIMES[pid].fail++;
        } else {
          CHECK_TIMES[pid].fail = 0;
        }
        CHECK_TIMES[pid].now = 0;
        return this;
      }
      cmd = msg != null ? msg.cmd : void 0;
      if (cmd) {
        func = '';
        if (cmd === 'jt_restart') {
          func = 'disconnect';
        } else if (cmd === 'jt_restartall') {
          func = 'disconnect';
          pid = null;
        } else if (cmd === 'jt_kill') {
          func = 'kill';
        } else if (cmd === 'jt_killall') {
          func = 'kill';
          pid = null;
        }
        this._do(func, pid);
      }
      return this;
    };


    /**
     * _do 执行message中的命令
     * @param  {[type]} func    [description]
     * @param  {[type]} pid [description]
     * @return {[type]}         [description]
     */

    JTCluster.prototype._do = function(func, pid) {
      var beforeRestart, forceKill, restart;
      beforeRestart = this.options.beforeRestart;
      forceKill = function(worker) {
        var killtimer;
        killtimer = setTimeout(function() {
          if (worker.state !== 'dead') {
            return worker.kill();
          }
        }, 30000);
        return killtimer.unref();
      };
      restart = function(worker, pid) {
        if (pid) {
          if (worker.process.pid === pid) {
            worker[func]();
            if (func !== 'kill') {
              return forceKill(worker);
            }
          }
        } else {
          worker[func]();
          if (func !== 'kill') {
            return forceKill(worker);
          }
        }
      };
      if (func) {
        if (beforeRestart) {
          beforeRestart(function(err) {
            if (!err) {
              return Object.keys(cluster.workers).forEach(function(id) {
                var worker;
                worker = cluster.workers[id];
                return restart(worker, pid);
              });
            }
          });
        } else {
          Object.keys(cluster.workers).forEach(function(id) {
            var worker;
            worker = cluster.workers[id];
            return restart(worker, pid);
          });
        }
      }
      return this;
    };


    /**
     * _initEvent 初始化事件，消息的处理
     * @return {[type]} [description]
     */

    JTCluster.prototype._initEvent = function() {
      cluster.on('exit', (function(_this) {
        return function(worker) {
          var params, pid, _jtPid;
          pid = worker.process.pid;
          delete CHECK_TIMES[pid];
          _jtPid = worker._jtPid;
          params = {
            pid: pid,
            _jtPid: _jtPid
          };
          _this.emit('log', {
            category: 'exit',
            params: JSON.stringify(params),
            date: new Date()
          });
          worker = cluster.fork();
          worker.on('message', function(msg) {
            return _this._msgHandler(msg, worker.process.pid);
          });
          worker._jtPid = _jtPid;
          return worker.send({
            msg: SET_JT_PID_MSG,
            _jtPid: _jtPid
          });
        };
      })(this));
      Object.keys(cluster.workers).forEach((function(_this) {
        return function(id) {
          var worker;
          worker = cluster.workers[id];
          return worker.on('message', function(msg) {
            return _this._msgHandler(msg, worker.process.pid);
          });
        };
      })(this));
      cluster.on('online', (function(_this) {
        return function(worker) {
          var params, pid;
          pid = worker.process.pid;
          CHECK_TIMES[pid] = {
            fail: 0
          };
          params = {
            pid: pid,
            _jtPid: worker._jtPid
          };
          return _this.emit('log', {
            category: 'online',
            params: JSON.stringify(params),
            date: new Date()
          });
        };
      })(this));
      setTimeout((function(_this) {
        return function() {
          return _this._checkWorker();
        };
      })(this), this.options.interval);
      return this;
    };

    JTCluster.prototype._checkWorker = function() {
      Object.keys(cluster.workers).forEach((function(_this) {
        return function(id) {
          var params, pid, worker;
          worker = cluster.workers[id];
          pid = worker.process.pid;
          if (CHECK_TIMES[pid].now) {
            CHECK_TIMES[pid].fail++;
          }
          if (CHECK_TIMES[pid].fail >= _this.options.failTimes) {
            params = {
              pid: pid,
              _jtPid: worker._jtPid
            };
            _this.emit('log', {
              category: 'toobusy',
              params: JSON.stringify(params),
              date: new Date()
            });
            worker.kill();
          } else {
            if (worker.suicide) {
              CHECK_TIMES[pid].now = 0;
            } else {
              CHECK_TIMES[pid].now = Date.now();
              worker.send(CHECK_MSG);
            }
          }
        };
      })(this));
      setTimeout((function(_this) {
        return function() {
          return _this._checkWorker();
        };
      })(this), this.options.interval);
      return this;
    };

    return JTCluster;

  })(events.EventEmitter);

  JTCluster.restartAll = JTCluster.prototype.restartAll;

  module.exports = JTCluster;

}).call(this);
