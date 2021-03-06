import expect from 'expect';
import { create } from '../src/index';

const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout));

describe('effects', () => {
  it('put action', (done) => {
    const app = create();
    app.model({
      namespace: 'count',
      state: 0,
      reducers: {
        add(state, { payload }) { return state + payload || 1; },
      },
      effects: {
        *addDelay({ payload }, { put, call }) {
          yield call(delay, 100);
          yield put({ type: 'add', payload });
        },
      },
    });
    app.start();
    app._store.dispatch({ type: 'count/addDelay', payload: 2 });
    expect(app._store.getState().count).toEqual(0);
    setTimeout(() => {
      expect(app._store.getState().count).toEqual(2);
      done();
    }, 200);
  });

  it('put action with namespace will get a warning', (done) => {
    const app = create();
    app.model({
      namespace: 'count',
      state: 0,
      reducers: {
        add(state, { payload }) { return state + payload || 1; },
      },
      effects: {
        *addDelay({ payload }, { put, call }) {
          yield call(delay, 100);
          yield put({ type: 'add', payload });
        },
      },
    });
    app.start();
    app._store.dispatch({ type: 'count/addDelay', payload: 2 });
    expect(app._store.getState().count).toEqual(0);
    setTimeout(() => {
      expect(app._store.getState().count).toEqual(2);
      done();
    }, 200);
  });

  it('take', (done) => {
    const app = create();
    app.model({
      namespace: 'count',
      state: 0,
      reducers: {
        add(state, { payload }) { return state + payload || 1; },
      },
      effects: {
        *addDelay({ payload }, { put, call }) {
          yield call(delay, payload.delay || 100);
          yield put({ type: 'add', payload: payload.amount });
        },
        *test(action, { put, select, take }) {
          yield put({ type: 'addDelay', payload: { amount: 2 } });
          yield take('addDelay/@@end');
          const count = yield select(state => state.count);
          yield put({ type: 'addDelay', payload: { amount: count, delay: 0 } });
        },
      },
    });
    app.start();
    app._store.dispatch({ type: 'count/test' });
    setTimeout(() => {
      expect(app._store.getState().count).toEqual(4);
      done();
    }, 300);
  });

  it('dispatch action for other models', () => {
    const app = create();
    app.model({
      namespace: 'loading',
      state: false,
      reducers: {
        show() { return true; },
      },
    });
    app.model({
      namespace: 'count',
      state: 0,
      effects: {
        *addDelay(_, { put }) {
          yield put({ type: 'loading/show' });
        },
      },
    });
    app.start();
    app._store.dispatch({ type: 'count/addDelay' });
    expect(app._store.getState().loading).toEqual(true);
  });

  it('onError', () => {
    const errors = [];
    const app = create({
      onError: (error, dispatch) => {
        errors.push(error.message);
        dispatch({ type: 'count/add' });
      },
    });
    app.model({
      namespace: 'count',
      state: 0,
      reducers: {
        add(state, { payload }) { return state + payload || 1; },
      },
      effects: {
        *addDelay({ payload }, { put }) {
          if (!payload) {
            throw new Error('effect error');
          } else {
            yield put({ type: 'add', payload });
          }
        },
      },
    });
    app.start();
    app._store.dispatch({ type: 'count/addDelay' });
    expect(errors).toEqual(['effect error']);
    expect(app._store.getState().count).toEqual(1);
    app._store.dispatch({ type: 'count/addDelay', payload: 2 });
    expect(app._store.getState().count).toEqual(3);
  });

  it('type: takeLatest', (done) => {
    const app = create();
    const takeLatest = { type: 'takeLatest' };
    app.model({
      namespace: 'count',
      state: 0,
      reducers: {
        add(state, { payload }) { return state + payload || 1; },
      },
      effects: {
        addDelay: [function*({ payload }, { call, put }) {
          yield call(delay, 100);
          yield put({ type: 'add', payload });
        }, takeLatest],
      },
    });
    app.start();

    // Only catch the last one.
    app._store.dispatch({ type: 'count/addDelay', payload: 2 });
    app._store.dispatch({ type: 'count/addDelay', payload: 3 });

    setTimeout(() => {
      expect(app._store.getState().count).toEqual(3);
      done();
    }, 200);
  });

  xit('type: throttle throw error if no ms', () => {
    const app = create();
    app.model({
      namespace: 'count',
      state: 0,
      effects: {
        addDelay: [function*() { console.log(1); }, { type: 'throttle' }],
      },
    });
    expect(() => {
      app.start();
    }).toThrow(/app.start: opts.ms should be defined if type is throttle/);
  });

  it('type: throttle', (done) => {
    const app = create();
    app.model({
      namespace: 'count',
      state: 0,
      reducers: {
        add(state, { payload }) { return state + payload || 1; },
      },
      effects: {
        addDelay: [function*({ payload }, { call, put }) {
          yield call(delay, 100);
          yield put({ type: 'add', payload });
        }, { type: 'throttle', ms: 100 }],
      },
    });
    app.start();

    // Only catch the last one.
    app._store.dispatch({ type: 'count/addDelay', payload: 2 });
    app._store.dispatch({ type: 'count/addDelay', payload: 3 });

    setTimeout(() => {
      expect(app._store.getState().count).toEqual(2);
      done();
    }, 200);
  });

  it('type: watcher', (done) => {
    const watcher = { type: 'watcher' };
    const app = create();
    app.model({
      namespace: 'count',
      state: 0,
      reducers: {
        add(state, { payload }) { return state + payload || 1; },
      },
      effects: {
        addWatcher: [function*({ take, put, call }) {
          while (true) {
            const { payload } = yield take('addWatcher');
            yield call(delay, 100);
            yield put({ type: 'add', payload });
          }
        }, watcher],
      },
    });
    app.start();

    // Only catch the first one.
    app._store.dispatch({ type: 'count/addWatcher', payload: 2 });
    app._store.dispatch({ type: 'count/addWatcher', payload: 3 });

    setTimeout(() => {
      expect(app._store.getState().count).toEqual(2);
      done();
    }, 200);
  });

  xit('nonvalid type', () => {
    const app = create();
    app.model({
      namespace: 'count',
      state: 0,
      effects: {
        addDelay: [function*() { console.log(1); }, { type: 'nonvalid' }],
      },
    });

    expect(() => {
      app.start();
    }).toThrow(/app.start: effect type should be takeEvery, takeLatest, throttle or watcher/);
  });

  it('onEffect', (done) => {
    const SHOW = '@@LOADING/SHOW';
    const HIDE = '@@LOADING/HIDE';

    const app = create();

    // Test model should be accessible
    let modelNamespace = null;
    // Test onEffect should be run orderly
    let count = 0;
    let expectedKey = null;

    app.use({
      extraReducers: {
        loading(state = false, action) {
          switch (action.type) {
            case SHOW:
              return true;
            case HIDE:
              return false;
            default:
              return state;
          }
        },
      },
      onEffect(effect, { put }, model, key) {
        expectedKey = key;
        modelNamespace = model.namespace;
        return function*(...args) {
          count *= 2;
          yield put({ type: SHOW });
          yield effect(...args);
          yield put({ type: HIDE });
        };
      },
    });

    app.use({
      onEffect(effect) {
        return function*(...args) {
          count += 2;
          yield effect(...args);
          count += 1;
        };
      },
    });

    app.model({
      namespace: 'count',
      state: 0,
      reducers: {
        add(state) { return state + 1; },
      },
      effects: {
        *addRemote(action, { put }) {
          yield delay(100);
          yield put({ type: 'add' });
        },
      },
    });

    app.start();

    expect(app._store.getState().loading).toEqual(false);

    app._store.dispatch({ type: 'count/addRemote' });
    expect(app._store.getState().loading).toEqual(true);
    expect(modelNamespace).toEqual('count');
    expect(expectedKey).toEqual('count/addRemote');

    setTimeout(() => {
      expect(app._store.getState().loading).toEqual(false);
      expect(app._store.getState().count).toEqual(1);
      expect(count).toEqual(5);
      done();
    }, 200);
  });
});

