const EventEmitter = require('events');
const sentry = require('../../../src/observability/sentry');
const capture5xx = require('../../../src/observability/capture5xx');

function fakeRes() { const r = new EventEmitter(); r.statusCode = 200; return r; }

describe('capture5xx middleware', () => {
  let spy;
  beforeEach(() => { spy = jest.spyOn(sentry, 'captureException').mockImplementation(() => {}); });
  afterEach(() => { spy.mockRestore(); });

  test('calls next and reports a 5xx response with method/path/status', () => {
    const req = { method: 'POST', originalUrl: '/api/v1/parts' };
    const res = fakeRes();
    const next = jest.fn();
    capture5xx(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    res.statusCode = 500;
    res.emit('finish');
    expect(spy).toHaveBeenCalledTimes(1);
    const err = spy.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('500');
    expect(err.message).toContain('POST /api/v1/parts');
  });

  test('does not report a 2xx response', () => {
    const res = fakeRes();
    capture5xx({ method: 'GET', originalUrl: '/x' }, res, jest.fn());
    res.statusCode = 200;
    res.emit('finish');
    expect(spy).not.toHaveBeenCalled();
  });
});
