var v = require('./validation')
var pull = require('pull-stream')

//all curations
module.exports = function (sbot) {
  return {
    tags: function (opts) {
      return pull(
        sbot.query.read({query: [
          {$filter: {value: {content: {
            type: "curation",
            curate: {$prefix: ''}
          }}}},
          {$map: ['value', 'content', 'tags']}
        ]}),
        pull.flatten(),
        pull.map(function (e) {
          return e.split(/[ ,]+/)
        }),
        pull.flatten(),
        pull.filter(v.isTag)
      )
    },

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




