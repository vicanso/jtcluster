JTCluster = require '../dest/index'
jtDebug = require '../../jtdebug'
jtDebug JTCluster
options = 
  # 检测的时间间隔
  interval : 10 * 1000
  # worker检测的超时值
  timeout : 5 * 1000
  # 连续失败多少次后重启
  failTimes : 5
  # 子进程的个数
  slaveTotal : 1
  restartOnError : true
  slaveHandler : ->
    http = require 'http'
    server = http.createServer (req, res) ->
      if req.url == '/restart'
        process.send {
          cmd : 'jt_restart'
          timeout : 30000
        }
      if req.url == '/restartall'
        process.send {
          cmd : 'jt_restartall'
          timeout : 30000
        }
      else if req.url == '/kill'
        process.send {cmd : 'jt_kill'}
      else if req.url == '/fullrun'
        setTimeout ->
          while true
            j = 0
          return
        , 100
      else if req.url == '/error'
        throw new Error 'throw error'
      res.writeHead 200
      res.end 'hello world'
    port = 10000
    server.listen port
    console.dir "listen on #{port}"
  beforeRestart : (cbf) ->
    #do some before restart
    setTimeout ->
      cbf null
    , 10000


jtCluster = new JTCluster options
if jtCluster.isWorker
  jtCluster.send '测试', (err, data) ->
    console.dir data
# jtCluster.on 'jtPid', (jtPid) ->
#   process._jtPid = jtPid
#   if jtPid == 0
#     setTimeout ->
#       console.dir '.jaojfoeajfoe'
#       jtCluster.getAllWorkderStatus (err, statusList) ->
#     , 1000
#   return
# jtCluster.on 'status', (msgId) ->
#   jtCluster.send {
#     type : 'reply'
#     id : msgId
#     uptime : process.uptime()
#   }

# jtCluster.on 'log', (data) ->
#   console.dir data
