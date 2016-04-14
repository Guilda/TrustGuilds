var api = require('./api')
var pull = require('pull-stream')

if(!module.parent) {
  var _require = require
  var opts = _require('minimist')(process.argv.slice(3))
  var cmd = process.argv[2]
  delete opts._
//  delete opts.$0
  console.log(opts, Object.keys(opts).length)
  if(Object.keys(opts).length == 0)
    opts = process.argv[3]

  _require('ssb-client')(function (err, sbot) {
    pull(
      api(sbot)[cmd](opts),
      _require('pull-stringify')('', '\n', '\n\n', 2),
      pull.drain(process.stdout.write.bind(process.stdout), function (err) {
        if(err && err !== true) throw err
      })
    )
  })

}



