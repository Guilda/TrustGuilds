
var h = require('hyperscript')
function px (n) { return n+'px' }

// a temporary popup that appears on hover.

module.exports = function () {

  var status = h('span', {
    style: {
      position: 'fixed',
      left: px(20), bottom: px(20),
      background: 'white'
    }
  })
  var owner = null
  document.body.appendChild(status)

  status.hover = function (el, fn) {
    el.onmouseover = function () {
      console.log('show', owner == el)
      if(owner != el) {
        status.innerHTML = ''
        owner = el
        status.appendChild(fn())
      }
      status.style.display = 'block'
    }
    el.onmouseout = function () {
      setTimeout(function () {
        if(owner == el)
          status.style.display = 'none'
      }, 500)
    }
  }

  return status

}




