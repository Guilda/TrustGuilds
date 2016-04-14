var start = Date.now()
var defer = require('pull-defer')
var observ = require('observable')
var pull = require('pull-stream')
var Scroll = require('pull-scroll')
var h = require('hyperscript')
var ssbc = require('ssb-client')
var markdown = require('ssb-markdown')
var Cat = require('pull-cat')
var mentions = require('ssb-mentions')

var fs = require('fs')
var path = require('path')

var API = require('./api')

var suggest = require('suggest-box')

var Columns = require('column-deck')
var Stack = require('column-deck/stack')

var moment = require('moment')
var jade = require('jade')

var validation = require('./validation')

function px (n) { return n+'px' }


// With this data, render the given template at path
function Jade (data, template_path){
  var rendered_page = jade.renderFile(template_path, data);
  var new_page_element = document.createElement('span')

  new_page_element.innerHTML = rendered_page;

  return new_page_element;
}

var dock = Columns({width: 600, margin: 20})

document.body.style.margin = px(0)
document.body.style.padding = px(0)

document.body.appendChild(h('style', '.selected { color: red };'))

document.body.appendChild(h('style',
  fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8')
))
document.body.appendChild(h('style',
  fs.readFileSync(path.join(__dirname, 'bootstrap.min.css'), 'utf8')
))

var lightbox = require('./lightbox')()
document.body.appendChild(lightbox)

var status = require('./status')()
document.body.appendChild(status)

//document.body.appendChild(dock)

function click(name, action, class_names) {
  return h('a', {href: '#', onclick: action, className: class_names}, name)
}

function maxKey (obj) {
  var m
  for (var k in obj)
    m = (m == null ? k : obj[m] < obj[k] ? k : m)
  return m
}

function once (cont) {
  var ended = false
  return function (abort, cb) {
    if(abort) return cb(abort)
    else if (ended) return cb(ended)
    else
      cont(function (err, data) {
        if(err) return cb(ended = err)
        ended = true
        cb(null, data)
      })
  }
}

function first(stream, cb) {
  pull(stream, pull.find(cb))
}

function name (id) {
  var n = h('span', id.substring(0, 10))
  //choose the most popular name for this person.
  //for anything like this you'll see I have used sbot.links2
  //which is the ssb-links plugin. as you'll see the query interface
  //is pretty powerful!
  //TODO: "most popular" name is easily gameable.
  //must come up with something better than this.
  first(
    sbot.links2.read({query: [
      {$filter: {rel: ['mentions', {$prefix: '@'}], dest: id}},
      {$reduce: {
        $group: [['rel', 1]],
        $count: true
      }}
    ]}),
    function (err, names) {
      if(err) throw err
      n.textContent = maxKey(names) || id.substring(0, 10)
    })

  return n
}

//show how many people have voted, replied, or mentioned this message.
function stats (id) {
  var span = h('span')
  first(
    sbot.links2.read({query: [
      {$filter: {dest: id}},
      {$reduce: {$group: [['rel', 0]], $collect: 'source'}}
    ]}),
    function (err, feedback) {

      if(feedback.root)
        span.appendChild(h('div', 'replies:', feedback.root.map(name)))
      if(feedback.vote)
        span.appendChild(h('div', 'yup:', feedback.vote.map(name)))
    }
  )
  return span
}

function feedback (id) {
  var f = h('span')

  first(
    sbot.links2.read({query: [
      {$filter: {dest: id}},
      {$reduce: {$group: [['rel', 0]], $count: true}}
    ]}), function (err, feedback) {
        if(err || !feedback) return
        var s = []
        if(feedback.root) s.push('R:'+feedback.root)
        //this ignores that votes can be positive or negative.
        //they are nearly always positive.
        if(feedback.vote) s.push('Y:'+feedback.vote)
        if(feedback.mention) s.push('M:'+feedback.mention)
        f.textContent = s.join(' ')
    })

  status.hover(f, function () {
    return stats(id)
  })

  return f
}

function toggle(off, on, change) {
  var state = false
  var a = h('a', {className: "btn btn-default", href: '#', onclick: function () {
    state = !state
    a.innerText = state ? on : off
    change(state)
  }}, off)
  change(state)
  return a
}

var streams = {
  all: function () {
    return API(sbot).curations()
  },
  user: function (id) {
    return sbot.createUserStream({ id: id, reverse: true })
  },
  thread: function (root) {
    //in this case, it's inconvienent that panel only takes
    //a stream. maybe it would be better to accept an array?
    var source = defer.source()
    pull(
      Cat([
        once(function (cb) {
          sbot.get(root, function (err, value) {
            cb(err, {key: root, value: value})
          })
        }),
        sbot.links({rel: 'root', dest: root, values: true, keys: true})
      ]),
      pull.collect(function (err, thread) {
        thread.sort(function (a, b) {
          //THIS IS WRONG AND HAS KNOWN BUGS!!!
          //TODO: sort by cryptographic causal ordering.
          return a.value.timestamp - b.value.timestamp
        })
        console.log(thread)
        source.resolve(pull.values(thread))
      })
    )

    return source
  }
}

function render (data) {
  if(!data.value) throw new Error('data missing value property')
  // console.log(data);

  data = { data: data, moment: moment }

  return Jade(data, "view/post.jade")

  // return h('span', h('div.post',
  //   h('div.title',
  //     click(
  //       name(data.value.author),
  //       function () {
  //         createPanel(streams.user(data.value.author))
  //       }
  //     ),
  //     ' ',
  //     h('label', data.value.content.type || 'encrypted'),
  //     ' ',
  //     click(
  //       moment(data.value.timestamp).fromNow(),
  //       function () {
  //         createPanel(streams.thread(data.value.content.root || data.key))
  //       }
  //     )
  //   ),
  //   h('div', {
  //       style: {width: px(450), overflow: 'hidden'}
  //     },
  //     data.value.content.text ? (function () {
  //       var text = h('div')
  //       text.innerHTML = markdown.block(data.value.content.text, data.value.content.mentions)
  //       return text
  //     })() : h('pre', JSON.stringify(data.value.content))
  //   ),
  //   feedback(data.key)
  // ), h('hr'))
}

//create a panel (column) from a stream of messages.
//a stream has several advantages, for example,
//messages that don't need to be displayed yet won't
//be rendered, so it's gentler on the database.
//
//it's probably not ideal to just treat everything
//as a scolling column, for example, on a user feed
//we should show some "profile" information at the top.
//
//and for a thread, we want a composer to appear at the _bottom_
//(after you have read the whole thread)
//
//but the best thing about just making it a stream,
//is that I want to make a column be a rendering of any database query.
//(TODO, expand on the patterns in ssb-links)

function createPanel (el, stream) {
  var scroll = h('div', {
    style: {
      width: px(500),
      height: px(500), //MAGIC.
      margin: px(0),
      padding: px(0),
      overflow: 'scroll',
    }
  })

  el.innerHTML = ''

  var stack = Stack()
    .addFixed(h('h3', 'feed', {style: {background: 'grey'}},
      //UGLY: it's really ugly that I put the whole composer
      //just inline like this. this should really be refactored
      //out completely. maybe into it's own repo?
      //I don't have support for thread replies yet.
      //those would need to be more coupled to the messages in the
      //thread because they would need to get the most recent message
      //for the branch link.
      click('post', function () {
        var url = h('input', {type: 'text', className: "form-control"})
        var url_bundle = h('label', "url", url)

        var title = h('input', {type: 'text', className: "form-control"})
        var title_bundle = h('label', "title", title)

        var rating = h('input', {type: 'text', className: "form-control"})
        var rating_bundle = h('label', "rating", rating)


        var one_liner = h('textarea', {rows: 2, cols: 80, className: "form-control"})
        var one_liner_bundle = h('label', "one liner", one_liner)

        var summary = h('textarea', {rows: 20, cols: 80, className: "form-control"})
        var summary_bundle = h('label', "summary", summary)

        var tags = h('input', {type: 'text', className: "form-control"})
        var tags_bundle = h('label', "tags", tags)

        var prev = h('span')

        var form = h('form', h('div', {className: 'form-group'}))

        form.appendChild(url_bundle)
        form.appendChild(title_bundle)
        form.appendChild(one_liner_bundle)
        form.appendChild(rating_bundle)
        form.appendChild(summary_bundle)
        form.appendChild(tags_bundle)

        var tog
        lightbox.show(h('span',
          tog = h('div', form),
          h('br'),
          click('cancel', lightbox.close, 'btn btn-warning'),
          ' ',
          toggle('preview', 'edit', function (state) {
            tog.innerHTML = ''
            if(!state){
              tog.appendChild(form)
            }
            else {
              prev.innerHTML = markdown.block(summary.value)
              tog.appendChild(prev)
            }
            lightbox.center()
          }, 'btn btn-default'),

          click('publish', function () {

            var content = {
              type: 'curation',
              curate: '',
              url: url.value,
              title: title.value,
              oneLiner: one_liner.value,
              summary: summary.value,
              mentions: mentions(summary.value),
              tags: tags.value.split(),
              rating: parseFloat(rating.value)
            }

            // If valid, publish this curation
            try{
              validation.curation(content)

              sbot.publish(content, function (err, msg) {
                alert('published: '+ msg.key || JSON.stringify(msg))
                lightbox.close()
              })
            }
            catch(e){
              alert(e);
            }
          }, 'btn btn-success')
        ))

        suggest(summary, function (word, cb) {
          if(!/^[@%&!]/.test(word[0])) return cb()
          if(word.length < 2) return cb()

          var sigil = word[0]
          var embed = ((sigil === '!') ? '!' : '')
          if(embed) sigil = '&'
          if(word[0] !== '@') word = word.substring(1)

          first(
            sbot.links2.read({query: [
              {$filter: {rel: ['mentions', {$prefix: word}], dest: {$prefix: sigil}}},
              {$reduce: {$group: [['rel', 1], 'dest'], $count: true}}
            ]}),
            function (err, names) {
              var ary = []
              for(var name in names)
                for(var id in names[name])
                  ary.push({name: name, id: id, count: names[name][id]})

              ary = ary
              .filter(function (e) {
                if(!embed) return true
                return /\.(gif|jpg|png|svg)$/i.test(e.name)
              }).sort(function (a, b) {
                return b.count - a.count
              }).map(function (e) {
                return {
                  title: e.name + ': ' + e.id.substring(0,10)+' ('+e.count+')',
                  value: embed+'['+e.name+']('+e.id+')'
                }
              })

              cb(null, ary)
            }
          )
        })
      }),
      ' ',
      click('close', function () {
        dock.remove(stack)
      })
    ))
    .addFitted(scroll)

    el.appendChild(stack)

//  dock.add(stack)

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
  var el = Jade(null, 'view/layout.jade')
  document.body.appendChild(el)
  var content = el.querySelector('#content')
  console.log()
  createPanel(content, streams.all())
//  createPanel(streams.all())
})
