

function isDef (s) {
  return s !== undefined
}

function isString(s) {
  return 'string' === typeof s
}

function isLength (s, len, optional) {
  if(optional) {
    if(!isDef(s)) return true
  }
  return isString(s) && len >= s.length
}

function valid(test, msg) {
  if(!test) throw new Error('msg')
}

function isTag(t) {
  return /^\#[A-z0-9_\-]+$/
}

function isNumber (n) {
  return 'number' === typeof n
}

exports.curation = function (content) {

  valid(content.type === 'curation', 'content.type must be: "curation"')
  valid(isString(content.curate), 'content.curate link missing')
  valid(isLength(content.title, 60) && 'content.title must be string < 60 chars')
  valid(isLength(content.oneLiner, 100) && 'content.oneLiner must be string < 100 chars')
  valid(isLength(content.summary, 1000) && 'content.title must be string < 1000 chars')
  isArray
  valid(isArray(content.tags), 'content.tags must be array')
  valid(content.tags.every(isTag), 'invalid tags')
  valid(isNumber(content.rating) && content.rating >= 0 && content.rating <= 1,
    'rating must be between 0 and 1 inclusive'
    )
  return true
}

exports.isString = isString
exports.isTag = isTag
