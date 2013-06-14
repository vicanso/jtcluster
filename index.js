(function() {
  var cluster, domain, jtCluster, noop;

  cluster = require('cluster');

  domain = require('domain');

  noop = function() {};

  jtCluster = {
    /**
     * start 启动应用
     * @param  {[type]} @options [description]
     * @return {[type]}          [description]
    */

    start: function(options) {
      var i, total, _i;
      this.options = options;
      if (cluster.isMaster) {
        if (options.masterHandler) {
          options.masterHandler();
        }
        total = options.slaveTotal || require('os').cpus().length;
        for (i = _i = 0; 0 <= total ? _i < total : _i > total; i = 0 <= total ? ++_i : --_i) {
          cluster.fork();
        }
        return this._initEvent();
      } else {
        return this._slaveHandler();
      }
    },
    _slaveHandler: function() {
      var d, error, slaveHandler, _ref, _ref1;
      error = ((_ref = this.options) != null ? _ref.error : void 0) || noop;
      slaveHandler = (_ref1 = this.options) != null ? _ref1.slaveHandler : void 0;
      if (slaveHandler) {
        d = domain.create();
        d.on('error', function(err) {
          return error(err);
        });
        return d.run(function() {
          return slaveHandler();
        });
      }
    },
    _msgHandler: function(msg) {
      if ((msg != null ? msg.cmd : void 0) === 'restart') {
        if (this.options.beforeRestart) {
          return this.options.beforeRestart(function(err) {
            if (!err) {
              return Object.keys(cluster.workers).forEach(function(id) {
                return cluster.workers[id].disconnect();
              });
            }
          });
        } else {
          return Object.keys(cluster.workers).forEach(function(id) {
            return cluster.workers[id].disconnect();
          });
        }
      }
    },
    _initEvent: function() {
      var error, _ref,
        _this = this;
      error = ((_ref = this.options) != null ? _ref.error : void 0) || noop;
      cluster.on('exit', function(worker) {
        error(new Error("worker:" + worker.process.pid + " died!"));
        worker = cluster.fork();
        return worker.on('message', function(msg) {
          return _this._msgHandler(msg);
        });
      });
      Object.keys(cluster.workers).forEach(function(id) {
        return cluster.workers[id].on('message', function(msg) {
          return _this._msgHandler(msg);
        });
      });
      return cluster.on('online', function(worker) {
        return console.info("worker:" + worker.process.pid + " is online!");
      });
    }
  };

  module.exports = jtCluster;

}).call(this);
