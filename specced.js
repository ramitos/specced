var interpolate = require('util').format,
    async = require('async'),
    path = require('path'),
    fs = require('fs')

/********************************** SETUP *************************************/

var defaults = require('./defaults.json')
var runner = function () {},
    parse = {}, on = {},
    extend, specced

var getTimeout = function (ms, callback) {
  return setTimeout(callback, ms)
}

var run = function (fns, ms, callback, onError) {
  async.forEachSeries(fns, function (fn, callback) {
    var tid = getTimeout(ms, onError)
    fn(function () {
      clearTimeout(tid)
      callback()
    })

  }, callback)
}

/********************************* PARSE **************************************/

parse.specs = function (specs) {
  if(typeof specs === 'object') return specs
  if(!specs) {
    specs = {}
    return
  }
  
  var dir = path.resolve(specs)
  specs = {}

  fs.readdirSync(dir).forEach(function (spec) {
    if(!spec.match(/\.js?/)) return
    specs[spec.replace(/\.js?/, '')] = require(path.join(dir, spec))
  })

  this.specs = specs
}

parse.ba = function (spec, fns, helpers, callback) {
  if(spec.before && typeof spec.before === 'function')
    fns.push(spec.before.bind(null, helpers))

  if(callback) callback()

  if(spec.after && typeof spec.after === 'function')
    fns.push(spec.after.bind(null, helpers))
}

parse.parent = function (parent) {
  if(!parent.helpers) parent.helpers = {}
  var fns = []
  parse.ba(parent, fns, parent.helpers)
  if(parent.after) fns.pop()
  return fns
}

parse.timeout = function (timeout) {
  if(!timeout) this.timeout = defaults.timeout
}

parse.child_specs = function (specs, stack) {
  Object.keys(specs).forEach(function (spec) {
    if(typeof specs[spec] !== 'function') return

    stack.push(specs[spec].bind(null, this.helpers))
  }.bind(this))
}

parse.child = function (child, stack) {
  parse.ba(child, stack, this.helpers, function () {
    if(child.specs) parse.child_specs.call(this, child.specs, stack)
  }.bind(this))
  if(typeof child === 'function') stack.push(child.bind(null, this.helpers))
  return stack
}

on.parent = function (callback, onError) {
  var stack = []

  Object.keys(this.specs).forEach(function (spec) {
    parse.child.call(this, this.specs[spec], stack)
  }.bind(this))

  if(this.after) stack.push(this.after.bind(null, this.helpers))
  run(stack, this.timeout, callback, onError)
}

/******************************** SPECCED *************************************/

runner.prototype.run = function (onError, success) {
  parse.timeout.call(this, this.timeout)
  parse.specs.call(this, this.specs)
  run(parse.parent(this), this.timeout, on.parent.bind(this, success, onError), onError)
}

module.exports = specced = function () {
  return new runner
}