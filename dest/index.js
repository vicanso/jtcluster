(function() {
  var CHECK_INFOS, JTCluster, cluster, events, noop,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  cluster = require('cluster');

  events = require('events');

  CHECK_INFOS = {};

  noop = function() {};

  JTCluster = (function(_super) {
    __extends(JTCluster, _super);


    /**
     * constructor 构造函数
     * @param  {[type]} @options [description]
     * @return {[type]}          [description]
     */

    function JTCluster(options) {
      var childProcess, i, total, _base, _i;
      this.options = options != null ? options : {};
      this.isMaster = cluster.isMaster;
      this.isWorker = cluster.isWorker;
      if (cluster.isMaster) {
        options.interval = options.interval || 10 * 1000;
        options.timeout = options.timeout || 10 * 1000;
        options.failTimes = options.failTimes || 10 * 1000;
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
        this._initMasterEvent();
      } else {
        process.on('message', (function(_this) {
          return function(data) {
            if ((data != null ? data.category : void 0) !== 'jtCluster') {
              return _this;
            }
            data = data.data;
            if (data.type === 'reply') {
              return _this.emit(data.id, data);
            }
          };
        })(this));
        if (typeof (_base = this.options).slaveHandler === "function") {
          _base.slaveHandler();
        }
      }
    }


    /**
     * 生成消息唯一id
     * @return {[type]} [description]
     */

    JTCluster.prototype._uniqueId = function() {
      var str;
      str = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r, v;
        r = Math.random() * 16 | 0;
        if (c === 'x') {
          v = r;
        } else {
          v = r & 0x3 | 0x8;
        }
        return v.toString(16);
      });
      return str;
    };


    /**
     * _initMasterEvent 初始化事件，消息的处理
     * @return {[type]} [description]
     */

    JTCluster.prototype._initMasterEvent = function() {
      cluster.on('exit', (function(_this) {
        return function(worker) {
          var jtPid, params, pid;
          pid = worker.process.pid;
          delete CHECK_INFOS[pid];
          jtPid = worker._jtPid;
          params = {
            pid: pid,
            _jtPid: jtPid
          };
          _this.emit('log', {
            category: 'exit',
            params: JSON.stringify(params),
            date: new Date()
          });
          worker = cluster.fork();
          _this._initWorkerEvent(worker);
        };
      })(this));
      Object.keys(cluster.workers).forEach((function(_this) {
        return function(id) {
          _this._initWorkerEvent(cluster.workers[id]);
        };
      })(this));
      cluster.on('online', (function(_this) {
        return function(worker) {
          var params, pid, _jtPid;
          pid = worker.process.pid;
          _jtPid = worker._jtPid;
          CHECK_INFOS[pid] = {
            fail: 0
          };
          params = {
            pid: pid,
            _jtPid: _jtPid
          };
          _this.emit('log', {
            category: 'online',
            params: JSON.stringify(params),
            date: new Date()
          });
        };
      })(this));
      return this;
    };

    JTCluster.prototype._initWorkerEvent = function(worker) {
      worker.on('message', (function(_this) {
        return function(data) {
          if ((data != null ? data.category : void 0) !== 'jtCluster') {
            return _this;
          }
          data = data.data;
          return worker.send({
            category: 'jtCluster',
            data: {
              type: 'reply',
              id: data.id,
              msg: 'xxxxx'
            }
          });
        };
      })(this));
      return this;
    };


    /**
     * [send worker to master]
     * @param  {[type]} msg [description]
     * @param  {[type]} cbf [description]
     * @return {[type]}     [description]
     */

    JTCluster.prototype.send = function(msg, cbf) {
      var id;
      id = this._uniqueId();
      process.send({
        category: 'jtCluster',
        data: {
          msg: msg,
          id: id
        }
      });
      if (cbf) {
        this.once(id, function(data) {
          cbf(null, data);
        });
      }
    };

    return JTCluster;

  })(events.EventEmitter);

  module.exports = JTCluster;

}).call(this);
