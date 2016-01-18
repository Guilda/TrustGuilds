var start = Date.now()

var pull = require('pull-stream')
var Scroll = require('pull-scroll')
var h = require('hyperscript')
var ssbc = require('ssb-client')
var markdown = require('ssb-markdown')

var Columns = require('column-deck')
var Stack = require('column-deck/stack')

var moment = require('moment')

function px (n) { return n+'px' }

var dock = Columns({width: 600, margin: 20})

document.body.style.margin = px(0)
document.body.style.padding = px(0)

document.body.appendChild(dock)

function render (data) {
  return h('div.post',
    h('div.title',
      h('a', {
        href: '#',
        onclick: function () {
          createPanel(sbot.createHistoryStream({
            id: data.value.author, reverse: true
          }))
        }
      }, data.value.author.substring(0, 10)),
      ' ',
      h('label', data.value.content.type || 'encrypted'),
      ' ',
      h('a', {
        href: '#',
        onclick: function () {
        },
      }, moment(data.timestamp).fromNow())
    ),
    h('div', {
        style: {width: px(450), overflow: 'hidden'}
      },
      data.value.content.text ? (function () {
        var text = h('div')
        text.innerHTML = markdown.block(data.value.content.text, data.value.content.mentions)
        return text
      })() : h('pre', JSON.stringify(data.value.content))
    )
  )

//  return h('pre', JSON.stringify(data.value, null, 2))
}

function createPanel (stream) {
  var scroll = h('div', {
    style: {
      width: px(500),
      height: px(500), //MAGIC.
      margin: px(0),
      padding: px(0),
      overflow: 'scroll',
    }
  })

  var stack = Stack()
    .addFixed(h('h3', 'feed', {style: {background: 'grey'}}))
    .addFitted(scroll)

  dock.add(stack)

  pull(
    stream,
    pull.filter(function (e) {
      if(!e.sync) return true
    }),
    Scroll(scroll, render, false, false)
  )

}

ssbc(function (err, _sbot) {
  if(err) {
    document.body.appendChild(
      ERR = h('pre', {style: {
        position: 'fixed', left: px(20), top: px(20)
      }}, err.stack)
    )
    return
  }
  console.log('connected...', Date.now() - start)
  sbot = _sbot
  createPanel(sbot.createLogStream({reverse: true}))

//  pull(
//    sbot.createLogStream({live: true, gt: Date.now()}),
//    pull.filter(function (e) {
//      if(!e.sync) return true
//    }),
//    Scroll(scroll, render, true, true)
//  )
//

})























