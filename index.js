(function() {
  var CHECK_MSG, CHECK_TIMES, HEALTHY_MSG, cluster, jtCluster, noop;

  cluster = require('cluster');

  CHECK_TIMES = {};

  CHECK_MSG = 'WORKER_CHECK';

  HEALTHY_MSG = 'I AM HEALTHY';

  noop = function() {};

  jtCluster = {
    /**
     * start 启动应用
     * @param  {[type]} @options [description]
     * @return {[type]}          [description]
    */

    start: function(options) {
      var i, total, _i, _ref, _ref1, _ref2;
      this.options = options != null ? options : {};
      if (cluster.isMaster) {
        if ((_ref = options.interval) == null) {
          options.interval = 60 * 1000;
        }
        if ((_ref1 = options.timeout) == null) {
          options.timeout = 10 * 1000;
        }
        if ((_ref2 = options.failTimes) == null) {
          options.failTimes = 5;
        }
        if (options.masterHandler) {
          options.masterHandler();
        }
        total = options.slaveTotal || require('os').cpus().length;
        for (i = _i = 0; 0 <= total ? _i < total : _i > total; i = 0 <= total ? ++_i : --_i) {
          cluster.fork();
        }
        this._initEvent();
      } else {
        this._slaveHandler();
      }
      return this;
    },
    _slaveHandler: function() {
      var d, domain, error, slaveHandler, _ref, _ref1;
      error = ((_ref = this.options) != null ? _ref.error : void 0) || noop;
      slaveHandler = (_ref1 = this.options) != null ? _ref1.slaveHandler : void 0;
      domain = require('domain');
      if (slaveHandler) {
        d = domain.create();
        d.on('error', function(err) {
          return error(err);
        });
        d.run(function() {
          return slaveHandler();
        });
      }
      process.on('message', function(msg) {
        if (msg === CHECK_MSG) {
          return process.send(HEALTHY_MSG);
        }
      });
      return this;
    },
    _msgHandler: function(msg, pid) {
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
        if (cmd === 'restart') {
          func = 'disconnect';
        } else if (cmd === 'forcerestart') {
          func = 'kill';
        }
        this._do(func, msg.timeout);
      }
      return this;
    },
    _do: function(func, timeout) {
      var beforeRestart, forceKill;
      if (timeout == null) {
        timeout = 30000;
      }
      beforeRestart = this.options.beforeRestart;
      forceKill = function(worker) {
        return setTimeout(function() {
          if (worker.state !== 'dead') {
            return worker.kill();
          }
        }, timeout);
      };
      if (func) {
        if (beforeRestart) {
          beforeRestart(function(err) {
            if (!err) {
              return Object.keys(cluster.workers).forEach(function(id) {
                var worker;
                worker = cluster.workers[id];
                worker[func]();
                if (func !== 'kill') {
                  return forceKill(worker);
                }
              });
            }
          });
        } else {
          Object.keys(cluster.workers).forEach(function(id) {
            var worker;
            worker = cluster.workers[id];
            worker[func]();
            if (func !== 'kill') {
              return forceKill(worker);
            }
          });
        }
      }
      return this;
    },
    _initEvent: function() {
      var error, _ref,
        _this = this;
      error = ((_ref = this.options) != null ? _ref.error : void 0) || noop;
      cluster.on('exit', function(worker) {
        var pid;
        pid = worker.process.pid;
        delete CHECK_TIMES[pid];
        error(new Error("worker:" + pid + " died!"));
        worker = cluster.fork();
        return worker.on('message', function(msg) {
          return _this._msgHandler(msg, worker.process.pid);
        });
      });
      Object.keys(cluster.workers).forEach(function(id) {
        var worker;
        worker = cluster.workers[id];
        return worker.on('message', function(msg) {
          return _this._msgHandler(msg, worker.process.pid);
        });
      });
      cluster.on('online', function(worker) {
        var pid;
        pid = worker.process.pid;
        CHECK_TIMES[pid] = {
          fail: 0
        };
        return console.info("worker:" + pid + " is online!");
      });
      setTimeout(function() {
        return _this._checkWorker();
      }, this.options.interval);
      return this;
    },
    _checkWorker: function() {
      var _this = this;
      Object.keys(cluster.workers).forEach(function(id) {
        var pid, worker;
        worker = cluster.workers[id];
        pid = worker.process.pid;
        if (CHECK_TIMES[pid].now) {
          CHECK_TIMES[pid].fail++;
        }
        if (CHECK_TIMES[pid].fail >= _this.options.failTimes) {
          return worker.kill();
        } else {
          CHECK_TIMES[pid].now = Date.now();
          return worker.send(CHECK_MSG);
        }
      });
      setTimeout(function() {
        return _this._checkWorker();
      }, this.options.interval);
      return this;
    }
  };

  module.exports = jtCluster;

}).call(this);
