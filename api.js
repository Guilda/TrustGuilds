
var pull = require('pull-stream')

//all curations
module.exports = function (sbot) {
  return {
    //all curations.
    curations: function (opts) {
      return sbot.query.read({query: [
        {$filter: {value: {content: {
          type: "curation",
          curate: {$prefix: ''}
        }}}}
      ]})
    },
//    subscriptions: function (opts) {
//      return sbot.links2.read({query: [
//        {$filter: {dest: opts.dest,       ]})
//    },

//    follow: function (opts) {
//      sbot.publish({
//        type: "subscribe",
//        link: 
//      })
//    }

  }
}

if(!module.parent) {
  var opts = process.argv.slice(3)
  var cmd = process.argv[2]
  require('ssb-client')(function (err, sbot) {
    pull(
      module.exports(sbot)[cmd](opts),
      pull.drain(console.log, function (err) {
        if(err && err !== true) throw err
      })
    )
  })

}
