cluster = require 'cluster'
events = require 'events'

# 检测次数相关信息记录
CHECK_INFOS = {}
noop = ->



class JTCluster extends events.EventEmitter
  ###*
   * constructor 构造函数
   * @param  {[type]} @options [description]
   * @return {[type]}          [description]
  ###
  constructor : (@options = {}) ->
    # process.on 'message', (msg) ->
    #   console.dir "process isMaster:#{cluster.isMaster} pid:#{process.pid} #{msg}"
    @isMaster = cluster.isMaster
    @isWorker = cluster.isWorker
    if cluster.isMaster
      # 检测的时间间隔
      options.interval = options.interval || 10 * 1000
      # worker检测的超时值
      options.timeout = options.timeout || 10 * 1000
      # 连续检测失败多少次后重启
      options.failTimes = options.failTimes || 10 * 1000

      options.masterHandler() if options.masterHandler

      total = options.slaveTotal || require('os').cpus().length
      total = 1 if total < 1
      for i in [0...total]
        childProcess = cluster.fork()
        childProcess._jtPid = i
      @_initMasterEvent()
    else
      process.on 'message', (data) =>
        return @ if data?.category != 'jtCluster'
        data = data.data
        if data.type == 'reply'
          @emit data.id, data
      @options.slaveHandler?()

  ###*
   * 生成消息唯一id
   * @return {[type]} [description]
  ###
  _uniqueId : ->
    str = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace /[xy]/g, (c) ->
      r = Math.random() * 16 | 0
      if c == 'x'
        v = r
      else
        v = r & 0x3|0x8

      v.toString 16
    str

  ###*
   * _initMasterEvent 初始化事件，消息的处理
   * @return {[type]} [description]
  ###
  _initMasterEvent : ->
    cluster.on 'exit', (worker) =>
      # 当有worker退出时，重新fork一个新的
      pid = worker.process.pid
      delete CHECK_INFOS[pid]
      jtPid = worker._jtPid
      params =
        pid : pid
        _jtPid : jtPid
      @emit 'log', {
        category : 'exit'
        params : JSON.stringify params
        date : new Date()
      }

      worker = cluster.fork()
      @_initWorkerEvent worker
      return
    
    Object.keys(cluster.workers).forEach (id) =>
      @_initWorkerEvent cluster.workers[id]
      return

    cluster.on 'online', (worker) =>
      pid = worker.process.pid
      _jtPid = worker._jtPid
      CHECK_INFOS[pid] = {fail : 0}
      params = 
        pid : pid
        _jtPid : _jtPid
      @emit 'log', {
        category : 'online'
        params : JSON.stringify params
        date : new Date()
      }
      # @_sendToWorker {
      #   jtPid : _jtPid
      #   type : 'jtPid'
      # }, worker.id
      return
    @

  _initWorkerEvent : (worker) ->
    worker.on 'message', (data) =>
      return @ if data?.category != 'jtCluster'
      data = data.data
      worker.send {
        category : 'jtCluster'
        data :
          type : 'reply'
          id : data.id
          msg : 'xxxxx'
      }
    @

  ###*
   * [send worker to master]
   * @param  {[type]} msg [description]
   * @param  {[type]} cbf [description]
   * @return {[type]}     [description]
  ###
  send : (msg, cbf) ->
    id = @_uniqueId()
    process.send {
      category : 'jtCluster'
      data : 
        msg : msg
        id : id
    }
    if cbf
      @once id, (data) ->
        cbf null, data
        return
    return

  # ###*
  #  * [broadcast 广播给所有worker]
  #  * @param  {[type]} msg [description]
  #  * @return {[type]}     [description]
  # ###
  # broadcast : (msg)->
  #   if cluster.isMaster
  #     @_sendToWorker msg
  #   else
  #     data =
  #       msg : msg
  #       from : 'slave'
  #       type : 'broadcast'
  #       category : 'jtCluster'
  #     process.send data

  # send : (msg) ->
  #   if cluster.isMaster
  #     @_sendToWorker msg
  #   else
  #     data =
  #       msg : msg
  #       category : 'jtCluster'
  #       from : 'slave'
  #     process.send data

  # getAllWorkderStatus : (cbf) ->
  #   @broadcast {
  #     type : 'status'
  #   }




  # restartAll : ->


  # ###*
  #  * 生成消息唯一id
  #  * @return {[type]} [description]
  # ###
  # _uniqueId : ->
  #   str = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace /[xy]/g, (c) ->
  #     r = Math.random() * 16 | 0
  #     if c == 'x'
  #       v = r
  #     else
  #       v = r & 0x3|0x8

  #     v.toString 16
  #   str
  # _sendToWorker : (msg, workerId) ->
  #   data =
  #     id : @_uniqueId()
  #     from : 'master'
  #     msg : msg
  #     category : 'jtCluster'
  #   if workerId?
  #     cluster.workers[workerId].send data
  #   else
  #     Object.keys(cluster.workers).forEach (id) =>
  #       cluster.workers[id].send data
  #       return
  #   @

  # _initWorkerEvent : (worker) ->
  #   worker.on 'message', (data) =>
  #     return @ if data?.category != 'jtCluster' || data?.from != 'slave'
  #     type = data?.type
  #     msg = data?.msg
  #     if type == 'broadcast'
  #       @broadcast data.msg
  #       return @
      
  #     switch msg?.type
  #       when 'reply'
  #         console.dir msg
  #   @
  # ###*
  #  * _initMasterEvent 初始化事件，消息的处理
  #  * @return {[type]} [description]
  # ###
  # _initMasterEvent : ->
  #   cluster.on 'exit', (worker) =>
  #     # 当有worker退出时，重新fork一个新的
  #     pid = worker.process.pid
  #     delete CHECK_INFOS[pid]
  #     jtPid = worker._jtPid
  #     params =
  #       pid : pid
  #       _jtPid : jtPid
  #     @emit 'log', {
  #       category : 'exit'
  #       params : JSON.stringify params
  #       date : new Date()
  #     }

  #     worker = cluster.fork()
  #     @_initWorkerEvent worker
  #     return
    
  #   Object.keys(cluster.workers).forEach (id) =>
  #     @_initWorkerEvent cluster.workers[id]
  #     return

  #   cluster.on 'online', (worker) =>
  #     pid = worker.process.pid
  #     _jtPid = worker._jtPid
  #     CHECK_INFOS[pid] = {fail : 0}
  #     params = 
  #       pid : pid
  #       _jtPid : _jtPid
  #     @emit 'log', {
  #       category : 'online'
  #       params : JSON.stringify params
  #       date : new Date()
  #     }
  #     @_sendToWorker {
  #       jtPid : _jtPid
  #       type : 'jtPid'
  #     }, worker.id
  #     return
  #   @

  # _initSlaveMsgHandler : ->
  #   @on 'message', (data) ->
  #     type = data?.msg?.type
  #     switch type
  #       when 'jtPid'
  #         @emit 'jtPid', data.msg.jtPid
  #       when 'status'
  #         @emit 'status', data.id
  #       else
  #         console.dir data

module.exports = JTCluster

