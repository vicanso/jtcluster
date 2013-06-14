jtCluster = require '../index'
options = 
  slaveHandler : ->
    http = require 'http'
    server = http.createServer (req, res) ->
    	console.dir req.url
    	if req.url == '/restart'
      	process.send {cmd : 'restart'}
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