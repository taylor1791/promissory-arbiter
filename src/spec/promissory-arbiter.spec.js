jasmine.DEFAULT_TIMEOUT_INTERVAL = 35;

describe('Arbiter', function () {
  'use strict';

  it('is defined', function () {
    expect(Arbiter).toBeTruthy();
  });

  describe('instances', function () {
    var arbiter;
    beforeEach(function () {
      arbiter = Arbiter.create();
      arbiter.options.sync = true;
    });

    it('has configurable options', function () {
      expect(arbiter.options).toBeTruthy();
    });

    it('changing options affects all subscriptions', function () {
      expect(subPub('a.g.s.d.f.d')).toHaveBeenCalled();
      arbiter.options.sync = false;
      expect(subPub('x')).not.toHaveBeenCalled();
    });

    it('are not context sensitive', function () {
      var subscribe = arbiter.subscribe;
      subscribe('', noop);
    });

    describe('subscribe', function () {
      it('throws an error if the topic is not a string', function () {
        function f () {
          sub(null);
        }
        expect(f).toThrowError(/string/);
      });

      it('non-function subscriptions are treated as noops', function (cb) {
        arbiter.subscribe('a');
        pub('a').then(function (result) {
          expect(result.length).toBe(1);
          expect(result[0]).toBe();
          cb();
        });
      });

      it('an array of topics adds multiple subscriptions', function () {
        var spy = sub(['a', 'b']);
        pub('a');
        pub('b');
        expect(spy.calls.all().length).toBe(2);
      });

      it('topics can be seperated by a comma and whitespace', function () {
        var spy = sub('a, b');
        pub('a');
        pub('b');
        expect(spy.calls.all().length).toBe(2);
      });

      it('can ignore persisted messages', function () {
        pub('a', null, {persist: true});
        var spy = sub('a', null, {ignorePersisted: true});
        expect(spy).not.toHaveBeenCalled();
      });

      it('allows for changing `this`', function () {
        var spy, context;
        spy = context = jasmine.createSpy().and.callFake(function () {
          expect(this).toBe(context); // eslint-disable-line no-invalid-this
        });

        expect(subPub('a', spy, {}, context)).toHaveBeenCalled();
      });

      describe('has hierarchical topics', function () {
        it('seperate generations by a dot', function () {
          var spy = sub('a');
          subPub('ab');
          expect(spy).not.toHaveBeenCalled();
        });
      });
    });

    describe('publish', function () {
      it('throws an error if the topic is not a string', function () {
        function f () {
          pub(null);
        }
        expect(f).toThrowError(/string/);
      });

      it('invokes the subscriber', function () {
        expect(subPub('a')).toHaveBeenCalled();
      });

      it('provides published data to the subscribers', function () {
        var data = {};
        expect(subPubArg('a.a', data, 0)).toBe(data);
      });

      it('provides published topic to the subscribers', function () {
        expect(subPubArg('a.a', null, 1)).toBe('a.a');
      });

      it('is asynchronous by default', function (done) {
        var arbiter2 = Arbiter.create();
        var spy = jasmine.createSpy().and.callFake(function () {
          expect(arbiter2).toBe(spy);
          expect(spy).toHaveBeenCalled();
          done();
        });

        arbiter2.subscribe('a.a.a', spy);
        arbiter2.publish('a.a.a');
        arbiter2 = spy;

        expect(spy).not.toHaveBeenCalled();
      });

      describe('returned value', function () {
        it('is a Promise', function () {
          expect(pub('a') instanceof Promise).toBe(true);
        });

        it('fulfills after settlement', function (cb) {
          var r = ndp('aaaaa', 1);
          r.promise.then(cb);
          r.dps.resolve();
        });

        it('has the number of fulfilled promises', function (cb) {
          var r = ndp('aaaa.aaaa', 2, true, 1);
          r.promise.then(function () {
            expect(r.promise.fulfilled).toBe(2);
            cb();
          });

          // Ensure that promise is not resolved early
          setTimeout(r.dps[1].resolve);
        });

        it('has the number of rejected promises', function (cb) {
          var r = ndp('aaa.aaa.aaa', 1, false);
          r.promise.then(noop, function () {
            expect(r.promise.rejected).toBe(1);
            cb();
          });
        });

        it('has the number of pending promises', function (cb) {
          var r = ndp('aaa.aaa.aaa.aaa', 2, false, 1);
          r.promise.then(noop, function () {
            expect(r.promise.pending).toBe(1);
            cb();
          });
        });

        it('does not change after settlement', function (cb) {
          arbiter.options.latch = 1;

          var r = ndp('aa.aa.aa.aa', 2, true);
          r.promise.then(function () {
            expect(r.promise.fulfilled).toBe(1);
            cb();
          });
        });

        it('can be updated after settlement', function (cb) {
          arbiter.options.updateAfterSettlement = true;
          arbiter.options.latch = 1;

          var r = ndp('aa.aa.aa.aa.aa', 2, true);
          r.promise.then(function () {
            expect(r.promise.fulfilled).toBe(2);
            cb();
          });
        });

        it('works with node-style success callbacks', function (cb) {
          sub('a', function (data, topic, done) {
            done(null, 42);
          });

          pub('a').then(function (data) {
            expect(data[0]).toBe(42);
            cb();
          });
        });

        it('works with node-style failure callback', function (cb) {
          sub('a', function (data, topic, done) {
            done(42);
          });

          pub('a').then(noop, function (data) {
            expect(data[0]).toBe(42);
            cb();
          });
        });

        it('subscribers that throw errors fail', function (cb) {
          sub('a', function () {
            throw new Error();
          });

          pub('a').then(noop, function (errors) {
            expect(errors.length).toBe(1);
            cb();
          });
        });

        describe('fulfills', function () {
          it('to an array of values', function (cb) {
            var r = ndp('a.aa.aaa', 2, true);

            r.promise.then(function (results) {
              expect(results.length).toBe(2);
              cb();
            });
          });

          it('in fulfilment order', function (cb) {
            var r = ndp('a.aa.aaa.aaaa', 3);

            r.promise.then(function (results) {
              expect(results[0]).toBe(2);
              expect(results[1]).toBe(0);
              expect(results[2]).toBe(1);
              cb();
            });

            r.dps[2].resolve(2);
            r.dps[0].resolve(0);
            r.dps[1].resolve(1);
          });

          it('does not contain rejected', function (cb) {
            arbiter.options.latch = 0.5;

            var r = ndp('a.aa.aaa.aaaa.aaaaa', 2);
            r.promise.then(function (results) {
              expect(results.length).toBe(1);
              cb();
            });

            r.dps[1].reject(1);
            r.dps[0].resolve(0);
          });
        });

        describe('rejects', function () {
          it('to an array of values', function (cb) {
            arbiter.options.latch = 0.5;

            var r = ndp('a.aa.aaa.aaaa.aaaaa.aaaaaa', 2, false);
            r.promise.then(noop, function (rejects) {
              expect(rejects.length).toBe(2);
              cb();
            });
          });

          it('in fulfilment order', function (cb) {
            arbiter.options.latch = 0.3;

            var r = ndp('1', 3);
            r.promise.then(noop, function (rejects) {
              expect(rejects[0]).toBe(2);
              expect(rejects[1]).toBe(0);
              expect(rejects[2]).toBe(1);
              cb();
            });

            r.dps[2].reject(2);
            r.dps[0].reject(0);
            r.dps[1].reject(1);
          });

          it('does not contain fulfills', function (cb) {
            arbiter.options.latch = 0.75;

            var r = ndp('1.2', 2, false, 1);
            r.promise.then(noop, function (rejects) {
              expect(rejects.length).toBe(1);
              cb();
            });

            r.dps[1].resolve(1);
          });
        });
      });

      describe('options', function () {
        it('higher priority first', function () {
          var
            spy1 = jasmine.createSpy(),
            spy2 = jasmine.createSpy().and.callFake(function () {
              expect(spy1).not.toHaveBeenCalled();
            });

          subPub('a', [spy1, spy2], [{priority: 10}, {priority: 20}]);

          expect(spy1).toHaveBeenCalled();
          expect(spy2).toHaveBeenCalled();
        });

        it('higher priority ancestors first', function () {
          var
            spy1 = jasmine.createSpy(),
            spy2 = jasmine.createSpy().and.callFake(function () {
              expect(spy1).not.toHaveBeenCalled();
            });

          sub('a', spy2, {priority: 10});
          subPub('a.a', spy1, {priority: 1});

          expect(spy1).toHaveBeenCalled();
          expect(spy2).toHaveBeenCalled();
        });

        it('sync invokes subscribers synchronously', function () {
          var spy = jasmine.createSpy().and.callFake(function () {
            expect(arbiter).not.toBe(spy);
          });

          sub('aa', spy);
          pub('aa', null, {sync: true});
          arbiter = spy;

          expect(spy).toHaveBeenCalled();
        });

        it('preventBubble only notifies the exact topic', function () {
          var spy1 = sub('aa.cc');
          var spy2 = sub('aa', null, {priority: 10});

          pub('aa.cc', null, {preventBubble: true});

          expect(spy1).toHaveBeenCalled();
          expect(spy2).not.toHaveBeenCalled();
        });

        it('preventBubble does not notify ancestors', function () {
          var spy = sub('app');

          pub('app.init', null, {preventBubble: true});

          expect(spy).not.toHaveBeenCalled();

        });

        it('allows late subscribers to recieve persisted topics', function () {
          expect(p1so('aa.bb.cc', 'aa.bb.cc')).toHaveBeenCalled();
        });

        it('late subscribers recieve persisted children topics', function () {
          expect(p1so('x.y.z', 'x')).toHaveBeenCalled();
        });

        it('persisted topics are published in the orginal order', function () {
          pub('xx.yy.zz', null, {persist: true});
          var spy = p1so('xx', 'xx');

          expect(spy).toHaveBeenCalled();
          expect(spy.calls.first().args[1]).toBe('xx.yy.zz');
          expect(spy.calls.mostRecent().args[1]).toBe('xx');
        });

        describe('latch', function () {
          it('fulfills after a number of fulfilled promises', function (cb) {
            arbiter.options.latch = 2;

            var r = ndp('1.2.3', 3, true, 2);
            r.promise.then(function () {
              expect(r.promise.fulfilled).toBe(2);
              cb();
            });
          });

          it('rejects when number of fulfilled is impossible', function (cb) {
            arbiter.options.latch = 1;

            pub('a').then(noop, cb);
          });

          it('rejects when fulfillment becomes impossible', function (cb) {
            arbiter.options.latch = 2;

            var r = ndp('1.2.11', 3, false, 2);
            r.promise.then(noop, cb);
          });

          it('fulfills after a fraction of fulfilled promises', function (cb) {
            arbiter.options.latch = 0.5;

            var r = ndp('1.11.0', 2, true, 1);
            r.promise.then(cb);
          });

          describe('settlementLatch', function () {
            it('fulfills after a number of settled promises', function (cb) {
              arbiter.options.settlementLatch = true;
              arbiter.options.latch = 2;

              var r = ndp('1.0.1', 2, true, 1);
              r.promise.then(cb);

              r.dps[1].reject();
            });

            it('fulfills after a fraction of settled promises', function (cb) {
              arbiter.options.settlementLatch = true;
              arbiter.options.latch = 0.66;

              var r = ndp('*.1', 3, true, 1);
              r.promise.then(cb);

              r.dps[1].reject();
            });

            it('can fail if there are not enough subscribers', function (cb) {
              arbiter.options.settlementLatch = true;
              arbiter.options.latch = 1;

              pub('a').then(noop, cb);
            });

            it('combines fulfilled and rejcted arrays', function (cb) {
              arbiter.options.settlementLatch = true;

              var r = ndp('!@#$%^&*().)(*&^%$#@!)', 2);
              r.promise.then(function (data) {
                expect(data.length).toBe(2);
                expect(data[0]).toBe(1);
                expect(data[1]).toBe(2);
                cb();
              });

              r.dps[0].resolve(1);
              r.dps[1].reject(2);
            });

            it('semaphor allows n concurrent subscribers', function (cb) {
              arbiter.options.semaphor = 1;

              var r = ndp('%', 3);

              expect(r.dps[0].spy).toHaveBeenCalled();
              expect(r.dps[1].spy).not.toHaveBeenCalled();
              expect(r.dps[2].spy).not.toHaveBeenCalled();
              r.dps[0].resolve();
              setTimeout(function () {
                expect(r.dps[1].spy).toHaveBeenCalled();
                expect(r.dps[2].spy).not.toHaveBeenCalled();
                r.dps[1].resolve();
                setTimeout(function () {
                  expect(r.dps[2].spy).toHaveBeenCalled();
                  r.dps[2].resolve();
                  cb();
                });
              });
            });
          });
        });
      });

      describe('hierarchical topics', function () {
        it('publishes to grandparents', function () {
          expect(s1po('a', 'a.b.c')).toHaveBeenCalled();
        });

        it('empty is the root topic', function () {
          expect(s1po('', 'a')).toHaveBeenCalled();
        });

        it('does not notifiy childrens', function () {
          expect(s1po('a.b', 'a')).not.toHaveBeenCalled();
        });

        it('does not notify siblings', function () {
          expect(s1po('a.b', 'a.c')).not.toHaveBeenCalled();
        });
      });
    });

    describe('unsubscribe', function () {
      it('does not invoke unsubscribed subscriptions', function () {
        var spy = sub('^');
        arbiter.unsubscribe(spy.token);
        pub('^');
        expect(spy).not.toHaveBeenCalled();
      });

      it('does not invoke suspended subscriptions', function () {
        var spy = sub('&');
        arbiter.unsubscribe(spy.token, true);
        pub('&');
        expect(spy).not.toHaveBeenCalled();
      });

      it('only removes the subscriber assicatied with a token', function () {
        var spy1 = sub('ʕʘ̅͜ʘ̅ʔ');
        var spy2 = sub('ʕʘ̅͜ʘ̅ʔ');
        sub('ʕʘ̅͜ʘ̅ʔ');
        arbiter.unsubscribe(spy1.token);
        pub('ʕʘ̅͜ʘ̅ʔ');
        expect(spy1).not.toHaveBeenCalled();
        expect(spy2).toHaveBeenCalled();
      });

      it('can unsubscribe groups of subscriptions', function () {
        var spy = sub('\'');
        arbiter.unsubscribe('\'');
        pub('\'');
        expect(spy).not.toHaveBeenCalled();
      });

      it('unsubscribes from descendents', function () {
        var spy = sub('"');
        arbiter.unsubscribe('');
        pub('"');
        expect(spy).not.toHaveBeenCalled();
      });

      it('does not invoke groups of suspended subscriptions', function () {
        var spy = sub('<');
        arbiter.unsubscribe('<', true);
        pub('<');
        expect(spy).not.toHaveBeenCalled();
      });

      it('returns true if the token is found', function () {
        var spy = sub(':-(');
        expect(arbiter.unsubscribe(spy.token)).toBe(true);
      });

      it('returns false if the token cannot be located', function () {
        expect(arbiter.unsubscribe({topic: '✈'})).toBe(false);
      });

      it('returns an array for multiple token', function () {
        var spy = sub(':-)');
        var result = arbiter.unsubscribe([spy.token, {topic: ''}]);
        expect(result.length).toBe(2);
        expect(result[0]).toBe(true);
        expect(result[1]).toBe(false);
      });

      it('returns true if the topic is found', function () {
        sub('༼ つ ◕_◕ ༽つ');
        expect(arbiter.unsubscribe('༼ つ ◕_◕ ༽つ')).toBe(true);
      });

      it('returns false if the token cannot be located', function () {
        expect(arbiter.unsubscribe('❚█══█❚')).toBe(false);
      });

      it('returns an array for multiple token', function () {
        var spy = sub('(っ◕‿◕)っ');
        var result = arbiter.unsubscribe([spy.token, {topic: ''}]);
        expect(result.length).toBe(2);
        expect(result[0]).toBe(true);
        expect(result[1]).toBe(false);
      });
    });

    describe('resubscribe', function () {
      it('allows for suspended subscriptions to be reactivated', function () {
        var spy = sub('\u2661');
        arbiter.unsubscribe(spy.token, true);
        arbiter.resubscribe(spy.token);
        pub('\u2661');
        expect(spy).toHaveBeenCalled();
      });

      it('can resubscribe groups of subscriptions', function () {
        var spy = sub('\u0000');
        arbiter.unsubscribe('\u0000', true);
        arbiter.resubscribe('\u0000');
        pub('\u0000');
        expect(spy).toHaveBeenCalled();
      });

      it('returns true if the token is found', function () {
        var spy = sub(':apple:');
        arbiter.unsubscribe(spy.token, true);
        expect(arbiter.resubscribe(spy.token)).toBe(true);
      });

      it('returns false if the token cannot be located', function () {
        expect(arbiter.resubscribe({token: ''})).toBe(false);
      });

      it('returns an array for multiple token', function () {
        var spy = sub('Int -> Int');
        arbiter.unsubscribe(spy.token, true);
        var result = arbiter.resubscribe([spy.token, {topic: ''}]);
        expect(result.length).toBe(2);
        expect(result[0]).toBe(true);
        expect(result[1]).toBe(false);
      });

      it('returns true if the topic is found', function () {
        var spy = sub('<.>');
        arbiter.unsubscribe('<.>', true);
        expect(arbiter.resubscribe(spy.token)).toBe(true);
      });

      it('returns false if the topic cannot be located', function () {
        expect(arbiter.resubscribe('(•_•)')).toBe(false);
      });

      it('returns an array for multiple token', function () {
        var spy = sub('¯\\_(ツ)_/¯');
        arbiter.unsubscribe(spy.token, true);
        var result = arbiter.resubscribe([spy.token, {topic: ''}]);
        expect(result.length).toBe(2);
        expect(result[0]).toBe(true);
        expect(result[1]).toBe(false);
      });
    });

    describe('removePersisted', function () {
      it('clears a specific persisted message', function () {
        var promise = pub('x', null, {persist: true});
        arbiter.removePersisted(promise);
        expect(sub('x')).not.toHaveBeenCalled();
      });

      it('clears descendent persisted messages', function () {
        pub('x', null, {persist: true});
        pub('x.x', null, {persist: true});
        arbiter.removePersisted('x');
        expect(sub('x')).not.toHaveBeenCalled();
        expect(sub('x.x')).not.toHaveBeenCalled();
      });

      it('does not clear ancestor persisted messages', function () {
        pub('', null, {persist: true});
        pub('x', null, {persist: true});
        arbiter.removePersisted('x');
        expect(sub('')).toHaveBeenCalled();
        expect(sub('x')).not.toHaveBeenCalled();
      });

      it('does not clear sibling persisted messages', function () {
        pub('x.x', null, {persist: true});
        pub('x.y', null, {persist: true});
        arbiter.removePersisted('x.y');
        expect(sub('x.x')).toHaveBeenCalled();
        expect(sub('x.y')).not.toHaveBeenCalled();
      });

      it('with no arguments empties all persisted', function () {
        pub('Int -> Int.where', null, {persist: true});
        arbiter.removePersisted();
        expect(sub('Int -> Int.where')).not.toHaveBeenCalled();
      });

      it('returns true if the token is found', function () {
        var spy = pub('person {id, name}', null, {persist: true});
        expect(arbiter.removePersisted(spy.token)).toBe(true);
      });

      it('returns false if the token cannot be located', function () {
        expect(arbiter.removePersisted({topic: ''})).toBe(false);
      });

      it('returns an array for multiple token', function () {
        var spy = pub('person {id, name}', null, {persist: true});
        var result = arbiter.removePersisted([spy.token, {topic: ''}]);
        expect(result.length).toBe(2);
        expect(result[0]).toBe(true);
        expect(result[1]).toBe(false);
      });

      it('returns true if the topic is found', function () {
        pub('SELECT * FROM users;', null, {persist: true});
        expect(arbiter.removePersisted('SELECT * FROM users;')).toBe(true);
      });

      it('returns false if the topic does not exist', function () {
        expect(arbiter.removePersisted('var x = 2 + 2;')).toBe(false);
      });

      it('returns an array for multiple token', function () {
        var spy = pub('var x = 1;', null, {persist: true});
        var result = arbiter.removePersisted([spy.token, {topic: 'var x=2;'}]);
        expect(result.length).toBe(2);
        expect(result[0]).toBe(true);
        expect(result[1]).toBe(false);
      });
    });

    describe('create', function () {
      it('creates a new arbiter', function () {
        expect(arbiter).toBeTruthy();
      });

      it('has the methods of Arbiter', function () {
        expect(arbiter.publish).toBeTruthy();
        expect(arbiter.subscribe).toBeTruthy();
        expect(arbiter.create).toBeTruthy();
      });

      it('has its own set of defaults', function () {
        var a = arbiter.create();
        expect(a.options.sync).toBeFalsy();
      });

      it('has its own subscribers', function () {
        var spy = sub('d');
        var a = arbiter.create();
        a.publish('d');
        expect(spy).not.toHaveBeenCalled();
      });
    });

    // ************************************************************************
    // Arbiter Utility Functions
    // ************************************************************************
    function sub (topic, spy, options, context) {
      spy = spy || jasmine.createSpy();
      spy.token = arbiter.subscribe(topic, spy, options, context);
      return spy;
    }

    function pub (topic, data, options) {
      return arbiter.publish(topic, data, options);
    }

    function subPub (topic, spy, options, context) {
      spy = spy || jasmine.createSpy();

      if (!Array.isArray(spy)) {
        spy = [spy];
      }

      if (!Array.isArray(options)) {
        options = repeat(spy.length, options);
      }

      spy.forEach(function (spyi, i) {
        sub(topic, spyi, options[i], context);
      });

      pub(topic);
      return spy.length === 1 ? spy[0] : spy;
    }

    // Publish 1 Subscribe Other
    function p1so (topic1, topic2) {
      pub(topic1, null, {persist: true});
      var spy = sub(topic2);
      return spy;
    }

    // Subscribe 1 Publish Other
    function s1po (topic1, topic2) {
      var spy = sub(topic1);
      pub(topic2);
      return spy;
    }

    // Subscribes to a topic, publishes data and returns the specified arguemnts
    function subPubArg (topic, data, i) {
      var spy = sub(topic);
      pub(topic, data);

      var args = spy.calls.first().args;
      return typeof i === 'undefined' ? args : args[i];
    }

    function ndp (topic, n, resolve, m) {
      m = typeof m === 'undefined' ? n : m;

      var dps = repeat(n, '').map(delayedPromise).map(function (dp) {
        dp.spy = jasmine.createSpy().and.callFake(always(dp.promise));
        sub(topic, dp.spy);
        return dp;
      });

      dps.forEach(function (dp, i) {
        if (i >= m) {
          return;
        }

        if (resolve === true) {
          dp.resolve();
        } else if (resolve === false) {
          dp.reject();
        }
      });

      return {
        promise: pub(topic),
        dps: dps.length === 1 ? dps[0] : dps
      };
    }
    // ************************************************************************
    // Generic Utility Functions
    // ************************************************************************
    function noop () {
    }

    function repeat (n, value) {
      return (Array.apply(null, Array(n))).map(function () {
        return value;
      });
    }

    function always (x) {
      return function () {
        return x;
      };
    }

    function delayedPromise () {
      var result = {};
      var promise = new Promise(function (resolve, reject) {
        result.resolve = resolve;
        result.reject = reject;
      });
      result.promise = promise;

      return result;
    }
  });
});

