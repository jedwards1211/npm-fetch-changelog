"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = once;

/**
 * 
 * @prettier
 */
function once(fn) {
  var result;
  var called = false;
  return function () {
    if (called) return result;
    called = true;
    return result = fn.apply(void 0, arguments);
  };
}