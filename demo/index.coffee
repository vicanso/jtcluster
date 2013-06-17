jtCluster = require '../index'
jtMonitor = require 'jtmonitor'
options = 
  slaveTotal : 1
  slaveHandler : ->
    http = require 'http'
    server = http.createServer (req, res) ->
    	if req.url == '/restart'
      	process.send {cmd : 'restart'}
      else if req.url == '/forcerestart'
        process.send {cmd : 'forcerestart'}
      res.writeHead 200
      res.end 'hello world'
    server.listen 8000
  error : (err) ->
    console.dir err
  beforeRestart : (cbf) ->
    #do some before restart
    setTimeout ->
      cbf null
    , 10000

jtCluster.start options
