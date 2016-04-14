var v = require('./validation')
var pull = require('pull-stream')

//all curations
module.exports = function (sbot) {
  return {
    //all curations.
    curations: function (opts) {
      var tags = []
      if(v.isString(opts)) {
        tags = opts.split(' ').filter(v.isTag)
      }
      return pull(
        sbot.query.read({query: [
          {$filter: {value: {content: {
            type: "curation",
            curate: {$prefix: ''}
          }}}}
        ]}),
        pull.filter(function (msg) {
          return tags.every(function (tag) {
            return ~msg.value.content.tags.indexOf(tag)
          })
        })
      )
    }
  }
}

if(!module.parent) {
  var opts = require('minimist')(process.argv.slice(3))
  var cmd = process.argv[2]
  delete opts._
//  delete opts.$0
  console.log(opts, Object.keys(opts).length)
  if(Object.keys(opts).length == 0)
    opts = process.argv[3]

  require('ssb-client')(function (err, sbot) {
    pull(
      module.exports(sbot)[cmd](opts),
      require('pull-stringify')('', '\n', '\n\n', 2),
      pull.drain(process.stdout.write.bind(process.stdout), function (err) {
        if(err && err !== true) throw err
      })
    )
  })

}
